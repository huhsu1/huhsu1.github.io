import * as ort from "https://cdn.jsdelivr.net/npm/onnxruntime-web/dist/esm/ort.min.js";

// Set the WebAssembly binary file path to jsdelivr CDN for latest dev version
ort.env.wasm.wasmPaths = 'https://cdn.jsdelivr.net/npm/onnxruntime-web/dist/';

const MODEL_PATH = "/scripts/implantclassifier/latest_run.onnx";
const IMAGE_SIZE = 299;

const IMPLANT_CLASSES = ['Biohorizon(bh) Biohorizon external(bio)', 'Cybermed(cy) core1(co1)', '네오바이오텍(ne) EB(eb)', '네오바이오텍(ne) IS I(is)', '네오바이오텍(ne) IS II(is2)', '네오바이오텍(ne) IS III(is3)', '노벨바이오케어(no) Replace select(rep)', '노벨바이오케어(no) branemark(bra)', '덴츠플라이(dp) Xive(xi)', '덴츠플라이(dp) ankylos(ank)', '덴츠플라이(dp) astra(ast)', '덴티스(ds) S clean tapered(scl)', '덴티움(dt) Simpleline(sim)', '덴티움(dt) Superline(su)', '덴티움(dt) implantium(im)', '디오임플란트(di) UF(uf)', '디오임플란트(di) UF2(uf2)', '메가젠임플란트(mz) Anyone external(aoe)', '메가젠임플란트(mz) Anyone internal(aoi)', '메가젠임플란트(mz) any ridge(ar)', '메가젠임플란트(mz) exfeel external(xex)', '메가젠임플란트(mz) exfeel internal(xin)', '바이오멧(bm) 3i(3i)', '스트라우만(st) Bone level(bl)', '스트라우만(st) TS standard (ts)', '스트라우만(st) TS standard plus(tspl)', '신흥(sh) luna(lu)', '신흥(sh) stella(sl)', '오스템(os) GS II(gs2)', '오스템(os) GS III(gs3)', '오스템(os) SS II(ss2)', '오스템(os) SS III(ss3)', '오스템(os) TS III(ts3)', '오스템(os) US II(us2)', '오스템(os) US III(us3)', '워렌텍(wa) Hexplant(ex)', '워렌텍(wa) internal(in)', '워렌텍(wa) it(it)', '워렌텍(wa) iu(iu)', '짐머(zi) TSV(tsv)', '짐머(zi) screw vent(sv)', '코웰메디(co) atlas internal(ati)'];

const EXAMPLE_IMAGE = "/scripts/implantclassifier/cropped.png";


// collapsible implant list
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

// change the implant names
var implantList = document.getElementById("implantlist");
implantList.innerText = IMPLANT_CLASSES.toString();



// Load Image
var canvas = document.getElementById("imageHolder");
var ctx = canvas.getContext("2d");
canvas.width = IMAGE_SIZE;
canvas.height = IMAGE_SIZE;
var imageLoader = document.getElementById("imageLoader");
imageLoader.addEventListener('change', handleImage, false);
var exampleButton = document.getElementById("example");
exampleButton.addEventListener("click", handleExample);
var image = new Image();

function handleExample(e) {
    image.onload = function() {
        drawImageOnCanvas(image);
        runPrediction(image);
    }
    image.src = EXAMPLE_IMAGE;
    imageLoader.value = "";
}

function handleImage(e) {
    var reader = new FileReader();
    reader.onload = function(event) {
        image.onload = function() {
            drawImageOnCanvas(image);
            runPrediction(image);
        }
        image.src = event.target.result;
    }
    reader.readAsDataURL(e.target.files[0]);
}

function drawImageOnCanvas(image) {
    ctx.drawImage(image, 0, 0, image.width, image.height, 0, 0, IMAGE_SIZE, IMAGE_SIZE);
}

function recordOutput(results, inferenceTime) {
    var writeTo = document.getElementById("output");
    var printString = "";
    for (let i = 0; i < results.length; i++) {
        var result = results[i];
        printString += `${result[0]}: ${(result[1] *
        100).toFixed(2)}%\n`;
    }
    printString += `It took ${inferenceTime}ms`;
    writeTo.innerText = printString;
    
}

/* -------- model prediction start ----------------------- */
// load the model and create InferenceSession
const session = await ort.InferenceSession.create(MODEL_PATH);
async function runPrediction() {
    var imageData = ctx.getImageData(0, 0, IMAGE_SIZE, IMAGE_SIZE).data;
    var inputTensor = rgbaToTensor(imageData);
    var [results, inferenceTime]  = await runInference(session, inputTensor);

    recordOutput(results, inferenceTime);
}

async function runInference(session, inputTensor) {
    // inference function taken from
    // https://onnxruntime.ai/docs/tutorials/web/classify-images-nextjs-github-template.html
    const start = new Date();
    var input = {};
    input[session.inputNames[0]] = inputTensor;
    var outputData = await session.run(input);
    const end = new Date();

    const inferenceTime = (end.getTime() - start.getTime());
    outputData = outputData["output"].cpuData;

    var outputSoftmax = softmax(outputData);

    var results = getTopkOutputs(outputSoftmax, 3);
    return [results, inferenceTime];
}
function softmax(array) {
    var expon = array.map(function(e, i) { return Math.exp(e); });
    var sum = 0;
    for (let i = 0; i < expon.length; i++) {
        sum += expon[i];
    }
    return expon.map(function(e, i) { return e / sum });
}

function getTopkOutputs(outputs, k) {
    var mapped = IMPLANT_CLASSES.map(function(e, i) {
        return [e, outputs[i]];
    });

    mapped.sort(function(a, b) { return b[1] - a[1]; });

    return mapped.slice(0, k);
}

function rgbaToTensor(imageData) {
    // Uint8ClampedArray imageData
    // has 299*299 RGBA cells flattened, or 4*299*299 items
    // convert to 1x3x299x299 that we love so much
    var dims = [1, 3, IMAGE_SIZE, IMAGE_SIZE];
    var colorStride = IMAGE_SIZE * IMAGE_SIZE;

    const float32Data = new Float32Array(dims[1] * dims[2] * dims[3]);
    for (let i = 0; i < colorStride; i++) {
        float32Data[i] = imageData[4*i + 0];
        float32Data[i + colorStride] = imageData[4*i + 1];
        float32Data[i + 2 * colorStride] = imageData[4*i + 2];
    }

    const inputTensor = new ort.Tensor("float32", float32Data, dims);
    return inputTensor;
}



/* -------- model prediction end ----------------------- */







