async function init() {
    fitToContainer(canvas);
    canvasRatio = canvas.width / canvas.offsetWidth;
    window.onresize = function() {
        console.log("resizing");
        canvasRatio = canvas.width / canvas.offsetWidth;
    }
    initCollapsibleList();

    // Logic Init
    numCircles = 0;

    await gpuInit();

    initEventListeners();
}

function fitToContainer(canvas) {
    canvas.style.width = "100%";
    canvas.style.height = "100%";
}

function initCollapsibleList() {
    var coll = document.getElementsByClassName("collapsible");

    for (let i = 0; i < coll.length; i++) {
        coll[i].addEventListener("click", function() {
            this.classList.toggle("active");
            var content = this.nextElementSibling;
            if (content.style.maxHeight) {
                content.style.maxHeight = null;
            } else {
                content.style.maxHeight = content.scrollHeight + "px";
            }
        });
    }
}


/* -------------- Events ----------------------------- */
function initEventListeners() {
    canvas.addEventListener("contextmenu", clickEvent, false);
    canvas.addEventListener("mousedown", mouseDownEvent);
    canvas.addEventListener("mouseup", mouseUpEvent);
    canvas.addEventListener("mousemove", mouseMoveEvent);
    createButton.addEventListener("click", createButtonEvent);
    strokeButton.addEventListener("click", strokeButtonEvent);
}

function clickEvent(e) {
    e.preventDefault();
    drop(e.offsetX * canvasRatio, e.offsetY * canvasRatio, 500);
    render();
    return false;
}

var mouse = {
    x: 0,
    y: 0,
    mouseDown: false
}

function mouseDownEvent(e) {
    if (e.button == 0) {
        mouse.x = e.offsetX * canvasRatio;
        mouse.y = e.offsetY * canvasRatio;
        mouse.mouseDown = true;
    }
}

var renderSwitch = document.getElementById("renderSwitch");

function mouseMoveEvent(e) {
    if (mouse.mouseDown) {
        var x = e.offsetX * canvasRatio;
        var y = e.offsetY * canvasRatio;
        var width = x - mouse.x;
        var height = y - mouse.y;
        if ((width * width) + (height * height) >= Lsquared) {
            stroke(mouse.x, mouse.y, x, y, characteristicLength);
            mouse.x = x;
            mouse.y = y;
            if (renderSwitch.checked) {
                render();
            }
        }
    }
}

function mouseUpEvent(e) {
    if (e.button == 0) {
        var x = e.offsetX * canvasRatio;
        var y = e.offsetY * canvasRatio;
        var width = x - mouse.x;
        var height = y - mouse.y;
        mouse.mouseDown = false;
        if ((width * width) + (height * height) > minLength) {
            stroke(mouse.x, mouse.y, x, y, characteristicLength);
            render();
        }
    }
}

function createButtonEvent(e) {
    createRandom(1000);
}

function strokeButtonEvent(e) {
    strokeRandom(1000);
}

/* -------------- Events End ------------------------- */


/* ------------- GPU Init ---------------------------- */

// can make 8192 x 8192 x int32 buffer
// note there has to be two if alternate
// need 24 bits or 3 bytes to write color -> prob better to just use int32
// my guess is create bigger and size down? makes no sense.
// need to fill in the gaps eventually

async function gpuInit() {
    await deviceInit();
    await initBuffers();
    initComputeShaders();
    initBindingLayout();
    initPipeline();
}

async function deviceInit() {
    if (!navigator.gpu) {
        throw Error("WebGPU not supported");
    }
    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) {
        throw Error("Couldn't request WebGPU adapter");
    }
    const device = await adapter.requestDevice()
    gpuPointers.device = device;
}

async function initBuffers() {

    gpuPointers.inputBuffer = gpuPointers.device.createBuffer( {
        size: 6*Float32Array.BYTES_PER_ELEMENT,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
    });



    const bufferSize = getBufferSize(SUPPORTED_NUM_DROPS);

    gpuPointers.srcBuffer = gpuPointers.device.createBuffer({
        mappedAtCreation: false,
        size: bufferSize,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC
    });

    // Read Buffer
    const gpuReadBuffer = gpuPointers.device.createBuffer( {
        label: "readBuffer",
        mappedAtCreation: false,
        size: bufferSize,
        usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST
    });
    gpuPointers.gpuReadBuffer = gpuReadBuffer;

}

function getBufferSize(numDrops) {
    return Float32Array.BYTES_PER_ELEMENT * (Math.min(numDrops,SUPPORTED_NUM_DROPS) * NUM_DETAIL * 2);
}

function initBindingLayout() {
    gpuPointers.bindGroupOneToOneLayout = gpuPointers.device.createBindGroupLayout({
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
                    type: "storage",
                }
            }
        ]
    });

    gpuPointers.bindGroupCreateDropLayout = gpuPointers.device.createBindGroupLayout({
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
                    type: "storage",
                    hasDynamicOffset: true // can get buffer at offset
                },
           }
        ]
    });
    gpuPointers.oneToOneBindGroup = gpuPointers.device.createBindGroup({
        label: "bindgroup with all vertices",
        layout: gpuPointers.bindGroupOneToOneLayout,
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
                    buffer: gpuPointers.srcBuffer,
                }
            }
        ]
    });
    gpuPointers.createDropBindGroup = gpuPointers.device.createBindGroup({
        label: "bindgroup to append new drop",
        layout: gpuPointers.bindGroupCreateDropLayout,
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
                    buffer: gpuPointers.srcBuffer,
                    size: NUM_DETAIL*4*2
                }
            }
        ]
    });
}

function initComputeShaders() {
   gpuPointers.dropShaderModule = gpuPointers.device.createShaderModule({
        code: `
            struct Input {
                dummy: f32,
                vertexCount: f32,
                newDropCenter: vec2f,
                radius: f32,
                dummy2: f32,
            }
            struct Drops {
               vertices: array<vec2f>,
            }

            @group(0) @binding(0) var<uniform> input : Input;
            @group(0) @binding(1) var<storage, read_write> source : Drops;

            @compute @workgroup_size(128)
            fn main(@builtin(global_invocation_id) global_id : vec3u) {

                let vertexPerDrop = u32(${NUM_DETAIL});
                // check bounds + new vertex
                let id = global_id.x;
                if (f32(id) >= input.vertexCount) {
                    return;
                }

                let pMinusC = source.vertices[id] - input.newDropCenter;
                let rhs = sqrt(1 + ((input.radius * input.radius) / ((pMinusC.x * pMinusC.x) + (pMinusC.y *
                pMinusC.y))));

                source.vertices[id] = input.newDropCenter + (pMinusC * rhs);
           }
        `
    });
    var angle = 2*Math.PI / NUM_DETAIL;
    gpuPointers.createDropShaderModule = gpuPointers.device.createShaderModule({
        code: `
            struct Input {
                dummy: f32,
                vertexCount: f32,
                newDropCenter: vec2f,
                radius: f32,
                dummy2: f32,
            }
            struct Drops {
                vertices: array<vec2f>,
            }

            @group(0) @binding(0) var<uniform> input : Input;
            @group(0) @binding(1) var<storage, read_write> destination : Drops;

            @compute @workgroup_size(64)
            fn main(@builtin(global_invocation_id) global_id : vec3u) {

                // destination offset for 0 at where we put the angle in

                let vertexPerDrop = u32(${NUM_DETAIL});
                let id = global_id.x;
                let fid = f32(id);
                if (id >= vertexPerDrop) {
                    return;
                }

                // calculate points around circle and add to the end
                let angle = f32(${angle}) * fid;

                let cart = vec2(cos(angle), sin(angle));

                destination.vertices[id] = cart * input.radius + input.newDropCenter;
          }
        `
    });

    gpuPointers.strokeShaderModule = gpuPointers.device.createShaderModule({
        code: `
            struct Input {
                strokeBegin: vec2f,
                strokeEnd: vec2f,
                L: f32,
                vertexCount: f32,
            }
            struct Drops {
                vertices: array<vec2f>,
            }
            @group(0) @binding(0) var<uniform> input : Input;
            @group(0) @binding(1) var<storage, read_write> source : Drops;

            @compute @workgroup_size(128)
            fn main(@builtin(global_invocation_id) global_id : vec3u) {
                let id = global_id.x;
                if (f32(id) >= input.vertexCount) {
                    return;
                }

                let p = source.vertices[id];
                let stroke = input.strokeEnd - input.strokeBegin;
                let N = normalize(stroke);
                let pMinusB = p - input.strokeBegin;
                
                let xb = dot(N, pMinusB);
                let xe = dot(N, p - input.strokeEnd);
                var ysquared = crossScalar(N, pMinusB);
                ysquared = ysquared * ysquared;

                // calc fxt
                let r = sqrt((xb*xb) + ysquared);
                let s = sqrt((xe*xe) + ysquared);
                let lhs = (1 - (ysquared/(r*input.L))) * exp(0-(r/input.L));
                let rhs = (1 - (ysquared/(s*input.L))) * exp(0-(s/input.L));

                let fxt = (lhs + rhs) / 2;

                source.vertices[id] = p + (stroke * fxt);
           }

           fn crossScalar(a:vec2f, b:vec2f) -> f32 {
               return (a.x * b.y) - (a.y * b.x);
           }
        `
    });
}

function initPipeline() {
    gpuPointers.dropComputePipeline = gpuPointers.device.createComputePipeline({
        layout: gpuPointers.device.createPipelineLayout({
            bindGroupLayouts: [gpuPointers.bindGroupOneToOneLayout]
        }), 
        compute: {
            module: gpuPointers.dropShaderModule,
            entryPoint: "main"
        }
    });

    gpuPointers.createDropComputePipeline = gpuPointers.device.createComputePipeline({
        layout: gpuPointers.device.createPipelineLayout({
            bindGroupLayouts: [gpuPointers.bindGroupCreateDropLayout]
        }),
        compute: {
            module: gpuPointers.createDropShaderModule,
            entryPoint: "main"
        }
    });

    gpuPointers.strokeComputePipeline = gpuPointers.device.createComputePipeline({
        layout: gpuPointers.device.createPipelineLayout({
            bindGroupLayouts: [gpuPointers.bindGroupOneToOneLayout]
        }),
        compute: {
            module: gpuPointers.strokeShaderModule,
            entryPoint: "main"
        }
    });
}

function copyDestBufferToReadBuffer() {
    const commandEncoder = gpuPointers.device.createCommandEncoder();
    // copy to read buffer at the end to finish
    commandEncoder.copyBufferToBuffer( gpuPointers.srcBuffer, 0,
    gpuPointers.gpuReadBuffer,0, getBufferSize(numCircles) );

    const gpuCommands = commandEncoder.finish();
    gpuPointers.device.queue.submit([gpuCommands]);
}

/* ----------------- GPU Init End ----------------------- */


/* ----------------- Drop Logic _________________________ */

async function drop(x, y, r) {

    var startTime = Date.now();

    var inputArray = new Float32Array([ 0, numCircles*NUM_DETAIL, x, y, r, 0 ]);

    colorArray[numCircles % SUPPORTED_NUM_DROPS] = getRandomColor();
    numCircles++;

    dropGPUSide(inputArray);
    var end = Date.now() - startTime;
    console.log(end);
    totalTime += end;
    howManyTimes += 1;
}


function dropGPUSide(inputArray) {
    // input input to inputBuffer 
    gpuPointers.device.queue.writeBuffer(gpuPointers.inputBuffer, 0, inputArray, 0, 6);
   
    // body
    submitDropComputeOnExisting();
    submitCreateDropCompute();

    // epilogue
    copyDestBufferToReadBuffer();
}

function submitCreateDropCompute() {
    const commandEncoder = gpuPointers.device.createCommandEncoder();

    const passEncoder = commandEncoder.beginComputePass();

    // append at the end. need - 1 so doesn't go out of buffer range
    let dynamicOffset = ((numCircles-1)%SUPPORTED_NUM_DROPS)*NUM_DETAIL*2*4;

    passEncoder.setPipeline(gpuPointers.createDropComputePipeline);
    passEncoder.setBindGroup(0, gpuPointers.createDropBindGroup, [dynamicOffset]);

    // 64 here because it's more usual number for num workers
    // out of bounds no longer a problem when just adding one drop
    const workgroupCountX = Math.ceil(NUM_DETAIL / 64);
    passEncoder.dispatchWorkgroups(workgroupCountX, 1);
    passEncoder.end();


    const gpuCommands = commandEncoder.finish();
    gpuPointers.device.queue.submit([gpuCommands]);
}

function submitDropComputeOnExisting() {
    const commandEncoder = gpuPointers.device.createCommandEncoder();

    const passEncoder = commandEncoder.beginComputePass();

    passEncoder.setPipeline(gpuPointers.dropComputePipeline);
    passEncoder.setBindGroup(0, gpuPointers.oneToOneBindGroup);
    // NOTE our work group size is 128 -> this means we dispatch work group by dividing by 128
    // no SIMD? is 128 wide, but I think it's an easy way to fit all my vertices
    // since it's just gonna make that work group go sequential which is the result anyways
    // this is because 65536 workgroup count can only fit 516 * 8192 verticies at 64 size
    const workgroupCountX = Math.ceil(Math.min(numCircles, SUPPORTED_NUM_DROPS) * NUM_DETAIL / 128);
    const workgroupCountY = 1;
    passEncoder.dispatchWorkgroups(workgroupCountX, workgroupCountY);
    passEncoder.end();

    // submit GPU commands
    const gpuCommands = commandEncoder.finish();
    gpuPointers.device.queue.submit([gpuCommands]);
}

/* ---------------- Drop Logic End ----------------------- */


/* ---------------- Stroke Logic ------------------------- */
function stroke(bx, by, ex, ey, L) {
    var startTime = Date.now();
    var inputArray = new Float32Array([ bx, by, ex, ey, L, numCircles * NUM_DETAIL ]);

    strokeGPU(inputArray);
    var end = Date.now() - startTime;
    console.log(end);
    totalTime += end;
    howManyTimes += 1;
}

function strokeGPU(inputArray) {
    // input input to inputBuffer 
    gpuPointers.device.queue.writeBuffer(gpuPointers.inputBuffer, 0, inputArray, 0, 6);

    // body
    strokeSubmit();

    // epilogue
    copyDestBufferToReadBuffer();
}

function strokeSubmit() {
    const commandEncoder = gpuPointers.device.createCommandEncoder();

    const passEncoder = commandEncoder.beginComputePass();

    passEncoder.setPipeline(gpuPointers.strokeComputePipeline);
    passEncoder.setBindGroup(0, gpuPointers.oneToOneBindGroup);
    // NOTE our work group size is 128 -> this means we dispatch work group by dividing by 128
    // no SIMD? is 128 wide, but I think it's an easy way to fit all my vertices
    // since it's just gonna make that work group go sequential which is the result anyways
    // this is because 65536 workgroup count can only fit 516 * 8192 verticies at 64 size
    const workgroupCountX = Math.ceil(Math.min(numCircles, SUPPORTED_NUM_DROPS) * NUM_DETAIL / 128);
    const workgroupCountY = 1;
    passEncoder.dispatchWorkgroups(workgroupCountX, workgroupCountY);
    passEncoder.end();

    // submit GPU commands
    const gpuCommands = commandEncoder.finish();
    gpuPointers.device.queue.submit([gpuCommands]);
}
/* ---------------- Stroke Logic End --------------------- */


/* ---------------- Render ------------------------------- */
async function render() {
    timeWrite.innerText = `Average Compute Time: ${Math.round(totalTime/howManyTimes)}ms`;
    await gpuPointers.gpuReadBuffer.mapAsync(GPUMapMode.READ);

    var arr = new Float32Array(gpuPointers.gpuReadBuffer.getMappedRange());
    draw(arr);
    gpuPointers.gpuReadBuffer.unmap();
}

function draw(arr) {
    ctx.fillStyle = "white";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    let offset = 0;
    if (numCircles > SUPPORTED_NUM_DROPS) {
        offset = numCircles % SUPPORTED_NUM_DROPS;
    }
    for (let j = 0; j < Math.min(numCircles, SUPPORTED_NUM_DROPS); j++) {
        let i = (j + offset) % SUPPORTED_NUM_DROPS;
        ctx.fillStyle = colorArray[i];
        ctx.beginPath();
        var start = 2*i*NUM_DETAIL;
        ctx.moveTo(arr[start], arr[start+1]);
        for (let i = 1; i < NUM_DETAIL; i++) {
            ctx.lineTo(arr[start + 2*i], arr[start + 2*i + 1]);
        }
        ctx.fill();
    }
}

/* ------------------- Render End --------------------- */


/* ------------------- Helpers ------------------------ */
function getRandomColor() {
    var letters = "0123456789ABCDEF";
    var color = "#";
    for (let i = 0; i < 6; i++) {
        color += letters[Math.floor(Math.random() * 16)];
    }
    return color;
}

async function createRandom(n, draw=false) {
    for (let i = 0; i < n; i++) {
        if (draw) {
            render();
        } 
        await drop(Math.random()*canvas.width, Math.random()*canvas.height,
        Math.random()*150 + 150);
    }
    render();
}

async function strokeRandom(n, draw=false) {
    for (let i = 0; i < n ; i++) {
        if (draw) {
            render();
        }
        let startX = Math.random()*canvas.width;
        let startY = Math.random()*canvas.height;
        let angle = Math.random()*2*Math.PI;
        let endX = startX + Math.cos(angle) * characteristicLength;
        let endY = startY + Math.sin(angle) * characteristicLength;;
        await stroke(startX, startY, endX, endY, characteristicLength);
    }
    render();
}
/* ------------------ Helpers End --------------------- */


const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");
var canvasRatio;

const gpuPointers = {};

// 1024 x 8192 x 4 is roughly 33MB buffer
const SUPPORTED_NUM_DROPS = 1023;
const NUM_DETAIL = 8192;
const SUPPORTED_NUM_VERTICES = SUPPORTED_NUM_DROPS * NUM_DETAIL
var numCircles;
const colorArray = [];
const characteristicLength = 100;
const Lsquared = characteristicLength * characteristicLength;
const minLength = characteristicLength / 10;
var totalTime = 0;
var howManyTimes = 0;
const timeWrite = document.getElementById("time");
const createButton = document.getElementById("createButton");
const strokeButton = document.getElementById("strokeButton");

init();

