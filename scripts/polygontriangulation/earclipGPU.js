
import { Point, crossProduct } from "./geometry.js";

async function earClipGPU(vertices) {
    if (vertices.length < 3) {
        console.log("Not valid");
        return null;
    }

    // init gpu
    const gpuPointers = await gpuInit(vertices);

    // shallow copy just to not mess with original input for reusability
    vertices = [...vertices];
    var triangles = [];
    var index = 0;
    while (vertices.length > 3) {
        var n = vertices.length;
        index %= n;
        var ear = await isEar(index, vertices, gpuPointers);
        if (ear) {
            triangles.push([  vertices[(index - 1 + n) % n],
                                vertices[index],
                                vertices[(index + 1) % n]
                            ]);
            vertices.splice(index, 1);
        } else {
            index++;
        }
    }
    triangles.push(vertices);
    return triangles;
}

async function isEar(index, vertices, gpuPointers) {
    // returns true if the given vertex is ear
    var n = vertices.length;
    var prevId = (index - 1 + n) % n;
    var nextId = (index + 1) % n;
    var curr = vertices[index];
    var prev = vertices[prevId];
    var next = vertices[nextId];
    // requires angle to be convex to be an ear
    if (crossProduct(prev, curr, next) > 0) {
        // call gpu point in triangle
        return !await pointsInTriangleGPU(vertices, prevId, index, nextId, prev, curr, next,
        gpuPointers);

    }
    return false;
}

async function pointsInTriangleGPU(vertices, prevId, currId, nextId, prev, curr, next, gpuPointers) {
    // prev, curr, next should be in UNIFORM
    // vertices as input, and each thread can take one
    // should also have boolean array that says taken -> taken shouldn't manipulate result
    // result is MAPREAD -> keep as false, see if any thread will turn it true;
    var inputArray = new Float32Array([prev.x, prev.y, curr.x, curr.y, 
                                       next.x, next.y, prevId, currId, nextId]);

    gpuPointers.device.queue.writeBuffer(gpuPointers.inputBuffer, 0, inputArray);

    resetResult(gpuPointers);
    submitCommands(vertices, gpuPointers);
    var ans = await readResult(gpuPointers);

    return ans == 1;
}


/* ----------- GPU INIT -------------------------------------------------- */

async function gpuInit(vertices) {
    const gpuPointers = {};
    await deviceInit(gpuPointers);
    await initBuffers(gpuPointers, vertices);
    initBindGroup(gpuPointers);
    initComputeShaders(gpuPointers);
    initPipeline(gpuPointers);

    return gpuPointers;
}

async function deviceInit(gpuPointers) {
    if (!navigator.gpu) {
        throw Error("WebGPU not supported");
    }
    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) {
        throw Error("Couldn't request WebGPU adapter");
    }
    const device = await adapter.requestDevice();
    gpuPointers.device = device;
}

async function initBuffers(gpuPointers, vertices) {
    // input buffer is the attempted triangle
    // should have prev, curr, next
    // each with float x, y, id -> 9 floats
    // And vertex length
    gpuPointers.inputBuffer = gpuPointers.device.createBuffer({
        size: (3 * 3 + 1) * Float32Array.BYTES_PER_ELEMENT,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
    });
    //writing in vertex length
    gpuPointers.device.queue.writeBuffer(gpuPointers.inputBuffer,
    9*Float32Array.BYTES_PER_ELEMENT, new Float32Array([vertices.length]));

    // vertices buffer is all vertices 2 * vertices.length * byte size
    // could be uniform since never changing
    // kept as storage since after 8k vertices, storage buffer exceeds size
    gpuPointers.verticiesBuffer = gpuPointers.device.createBuffer({
        size: 2 * vertices.length * Float32Array.BYTES_PER_ELEMENT,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
    });
    gpuPointers.device.queue.writeBuffer(gpuPointers.verticiesBuffer, 0,
                    new Float32Array(vertices.flat()));

    // one byte for result? -> if any point in ear
    // need dst too to reset
    gpuPointers.resultBuffer = gpuPointers.device.createBuffer({ 
        size: 1 * Float32Array.BYTES_PER_ELEMENT,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC
    });

    // need a buffer to take out into CPU
    gpuPointers.readBuffer = gpuPointers.device.createBuffer({
        size: 1 * Float32Array.BYTES_PER_ELEMENT,
        usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST
    });
}

function initBindGroup(gpuPointers) {
    gpuPointers.bindGroupLayout = gpuPointers.device.createBindGroupLayout({
        entries: [
            {
                binding: 0,
                visibility: GPUShaderStage.COMPUTE,
                buffer: {
                    type: "uniform"
                }
            },
            {
                binding: 1,
                visibility: GPUShaderStage.COMPUTE,
                buffer: {
                    type: "storage"
                }
            },
            {
                binding: 2,
                visibility: GPUShaderStage.COMPUTE,
                buffer: {
                    type: "storage"
                }
            }
        ]
    });

    gpuPointers.bindGroup = gpuPointers.device.createBindGroup({
        layout: gpuPointers.bindGroupLayout,
        entries: [
            {
                binding: 0,
                resource: {
                    buffer: gpuPointers.inputBuffer
                }
            },
            {
                binding: 1,
                resource: {
                    buffer: gpuPointers.verticiesBuffer
                }
            },
            {
                binding: 2,
                resource: {
                    buffer: gpuPointers.resultBuffer
                }
            }
        ]
    });
}

function initComputeShaders(gpuPointers) {
    gpuPointers.computeShaderModule = gpuPointers.device.createShaderModule({
        code: `
            struct Input {
                prev: vec2f,
                curr: vec2f,
                next: vec2f,
                prevId: f32,
                currId: f32,
                nextId: f32,
                vertexCount: f32,
            }
            struct Vertices {
                vertices: array<vec2f>,
            }
            struct Result {
                ans: f32,
            }

            @group(0) @binding(0) var<uniform> input : Input;
            @group(0) @binding(1) var<storage, read_write> vertices : Vertices;
            @group(0) @binding(2) var<storage, read_write> result : Result;

            @compute @workgroup_size(64)
            fn main(@builtin(global_invocation_id) global_id : vec3u) {
                let id = global_id.x;
                let fid = f32(id);
                if (fid >= input.vertexCount || fid == input.prevId || fid == input.currId ||
                        fid == input.nextId) {
                    return;
                }
                let t = vertices.vertices[id];
                let c0 = crossProduct(input.prev, input.curr, t);
                let c1 = crossProduct(input.curr, input.next, t);
                let c2 = crossProduct(input.next, input.prev, t);

                if ((c0 >= 0 && c1 >= 0 && c2 >= 0) || (c0 <= 0 && c1 <= 0 && c2 <= 0)) {
                    result.ans = 1;
                }
            }

            fn crossProduct(prev: vec2f, curr: vec2f, next: vec2f) -> f32 {
                let p1 = next - curr;
                let p2 = prev - curr;
                return (p1.x * p2.y) - (p1.y * p2.x);
            }
        `
    });
}

function initPipeline(gpuPointers) {
    gpuPointers.computePipeline = gpuPointers.device.createComputePipeline({
        layout: gpuPointers.device.createPipelineLayout({
            bindGroupLayouts: [gpuPointers.bindGroupLayout]
        }),
        compute: {
            module: gpuPointers.computeShaderModule,
            entryPoint: "main"
        }
    });
}

/* -------------------------------- GPU Init End ------------------------ */

/* -------------------------------- GPU Helpers ------------------------- */

function takeVertex(gpuPointers, vertex) {
    gpuPointers.device.queue.writeBuffer(gpuPointers.verticiesTakenBuffer,
                                         Float32Array.BYTES_PER_ELEMENT * vertex, 
                                         new Float32Array([1]));
}

function resetResult(gpuPointers) {
    gpuPointers.device.queue.writeBuffer(gpuPointers.resultBuffer, 0, new Float32Array([1]));
}

async function readResult(gpuPointers) {
    copyResultBufferToReadBuffer(gpuPointers);

    await gpuPointers.readBuffer.mapAsync(GPUMapMode.READ);
    var arr = new Float32Array(gpuPointers.readBuffer.getMappedRange());
    gpuPointers.readBuffer.unmap();
    return arr[0];
}

function copyResultBufferToReadBuffer(gpuPointers) {
    const commandEncoder = gpuPointers.device.createCommandEncoder();
    commandEncoder.copyBufferToBuffer( gpuPointers.resultBuffer, 0, 
                                       gpuPointers.readBuffer, 0,
                                       Float32Array.BYTES_PER_ELEMENT );

    const gpuCommands = commandEncoder.finish();
    gpuPointers.device.queue.submit([gpuCommands]);
}

function submitCommands(vertices, gpuPointers) {
    const commandEncoder = gpuPointers.device.createCommandEncoder();

    const passEncoder = commandEncoder.beginComputePass();
    passEncoder.setPipeline(gpuPointers.computePipeline);
    passEncoder.setBindGroup(0, gpuPointers.bindGroup);
    // NOTE workgorup size is 64 -> so dispatch by dividing by 64
    passEncoder.dispatchWorkgroups(Math.ceil(vertices.length / 64), 1);
    passEncoder.end();

    // submit commands
    const gpuCommands = commandEncoder.finish();
    gpuPointers.device.queue.submit([gpuCommands]);
}






export { earClipGPU }

