import * as ort from "https://cdn.jsdelivr.net/npm/onnxruntime-web/dist/esm/ort.min.js";

// Set the WebAssembly binary file path to jsdelivr CDN for latest dev version
ort.env.wasm.wasmPaths = 'https://cdn.jsdelivr.net/npm/onnxruntime-web/dist/';



const IMPLANT_CLASSES = ['Biohorizon(bh) Biohorizon external(bio)', 'Cybermed(cy) core1(co1)', '네오바이오텍(ne) EB(eb)', '네오바이오텍(ne) IS I(is)', '네오바이오텍(ne) IS II(is2)', '네오바이오텍(ne) IS III(is3)', '노벨바이오케어(no) Replace select(rep)', '노벨바이오케어(no) branemark(bra)', '덴츠플라이(dp) Xive(xi)', '덴츠플라이(dp) ankylos(ank)', '덴츠플라이(dp) astra(ast)', '덴티스(ds) S clean tapered(scl)', '덴티움(dt) Simpleline(sim)', '덴티움(dt) Superline(su)', '덴티움(dt) implantium(im)', '디오임플란트(di) UF(uf)', '디오임플란트(di) UF2(uf2)', '메가젠임플란트(mz) Anyone external(aoe)', '메가젠임플란트(mz) Anyone internal(aoi)', '메가젠임플란트(mz) any ridge(ar)', '메가젠임플란트(mz) exfeel external(xex)', '메가젠임플란트(mz) exfeel internal(xin)', '바이오멧(bm) 3i(3i)', '스트라우만(st) Bone level(bl)', '스트라우만(st) TS standard (ts)', '스트라우만(st) TS standard plus(tspl)', '신흥(sh) luna(lu)', '신흥(sh) stella(sl)', '오스템(os) GS II(gs2)', '오스템(os) GS III(gs3)', '오스템(os) SS II(ss2)', '오스템(os) SS III(ss3)', '오스템(os) TS III(ts3)', '오스템(os) US II(us2)', '오스템(os) US III(us3)', '워렌텍(wa) Hexplant(ex)', '워렌텍(wa) internal(in)', '워렌텍(wa) it(it)', '워렌텍(wa) iu(iu)', '짐머(zi) TSV(tsv)', '짐머(zi) screw vent(sv)', '코웰메디(co) atlas internal(ati)'];




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
var imageLoader = document.getElementById("imageLoader");
imageLoader.addEventListener('change', handleImage, false);
var image = new Image();

function handleImage(e) {
    var reader = new FileReader();
    reader.onload = function(event) {
        image.onload = function() {
            // TODO change what gets run
            predict(image);
        }
        image.src = event.target.result;
    }
    reader.readAsDataURL(e.target.files[0]);
}

function predict(image) {
    var output = document.getElementById("output");
    output.innerText = "this is totally the right output";
}












/* -------- model prediction start ----------------------- */
// load the model and create InferenceSession
const modelPath = "./latest-run.onnx";
const session = await ort.InferenceSession.create(modelPath);
const predictBeta = async () => async (image) => {
    var inputTensor = preProcess(image);
    console.log("starting prediction");
    var outputs = await session.run({ input: inputTensor });
}


/* -------- model prediction end ----------------------- */







