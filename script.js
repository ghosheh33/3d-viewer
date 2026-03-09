// --- نظام اللغات (i18n) ---
const translations = {
    ar: {
        loading: "جاري التحميل...",
        screenshot: "التقاط صورة",
        bgDark: "الخلفية: داكنة (افتراضي)",
        bgWhite: "الخلفية: بيضاء",
        bgGray: "الخلفية: استوديو رمادي",
        bgBlue: "الخلفية: أزرق ليلي",
        panelTitle: "إدارة النماذج والتحكم",
        selectModel: "اختر نموذجاً جاهزاً...",
        model1: "رائد فضاء",
        model2: "رائد فضاء ملون",
        model3: "الحج ميكي",
        model4: "سيارة",
        model5: "كوخ",
        upload: "رفع ملف",
        stopRotate: "إيقاف الدوران",
        startRotate: "تشغيل الدوران",
        height: "ارتفاع المجسم",
        fov: "مجال الرؤية (FOV)",
        hideUI: "إخفاء الواجهة",
        showUI: "إظهار الواجهة",
        hideGrid: "إخفاء الشبكة",
        showGrid: "إظهار الشبكة",
        error: "حدث خطأ!"
    },
    en: {
        loading: "Loading...",
        screenshot: "Screenshot",
        bgDark: "Background: Dark (Default)",
        bgWhite: "Background: White",
        bgGray: "Background: Studio Gray",
        bgBlue: "Background: Night Blue",
        panelTitle: "Model Management & Controls",
        selectModel: "Choose a ready model...",
        model1: "Astronaut",
        model2: "Colored Astronaut",
        model3: "Mickey",
        model4: "Car",
        model5: "Cottage",
        upload: "Upload File",
        stopRotate: "Stop Rotation",
        startRotate: "Start Rotation",
        height: "Model Height",
        fov: "Field of View (FOV)",
        hideUI: "Hide UI",
        showUI: "Show UI",
        hideGrid: "Hide Grid",
        showGrid: "Show Grid",
        error: "An error occurred!"
    }
};

let currentLang = 'ar';
let uiVisible = true;
let autoRotate = true;

function setLanguage(lang) {
    currentLang = lang;
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
    const t = translations[lang];

    document.getElementById('toggle-lang').textContent = lang === 'ar' ? 'English' : 'عربي';
    document.getElementById('screenshot-btn').textContent = t.screenshot;
    document.getElementById('panel-title-text').textContent = t.panelTitle;
    document.getElementById('upload-trigger').textContent = t.upload;
    document.getElementById('toggle-rotate').textContent = autoRotate ? t.stopRotate : t.startRotate;
    document.getElementById('label-height').textContent = t.height;
    document.getElementById('label-fov').textContent = t.fov;
    
    document.getElementById('toggle-ui').textContent = uiVisible ? t.hideUI : t.showUI;
    document.getElementById('toggle-grid').textContent = gridHelper.visible ? t.hideGrid : t.showGrid;

    const bgOptions = document.getElementById('bg-selector').options;
    if(bgOptions.length > 0) bgOptions[0].textContent = t.bgDark; 
    if(bgOptions.length > 1) bgOptions[1].textContent = t.bgWhite; 
    if(bgOptions.length > 2) bgOptions[2].textContent = t.bgGray; 
    if(bgOptions.length > 3) bgOptions[3].textContent = t.bgBlue;

    const modelOptions = document.getElementById('model-selector').options;
    if(modelOptions.length > 0) modelOptions[0].textContent = t.selectModel; 
    if(modelOptions.length > 1) modelOptions[1].textContent = t.model1; 
    if(modelOptions.length > 2) modelOptions[2].textContent = t.model2; 
    if(modelOptions.length > 3) modelOptions[3].textContent = t.model3; 
    if(modelOptions.length > 4) modelOptions[4].textContent = t.model4; 
    if(modelOptions.length > 5) modelOptions[5].textContent = t.model5;
}

document.getElementById('toggle-lang').addEventListener('click', () => {
    setLanguage(currentLang === 'ar' ? 'en' : 'ar');
});

// --- إعدادات Three.js ---
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x1a1a1c); 

const gridHelper = new THREE.GridHelper(20, 40, 0x555555, 0x222222);
scene.add(gridHelper);

const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
renderer.domElement.setAttribute('aria-label', 'شاشة عرض تفاعلية');
document.body.appendChild(renderer.domElement);

const controls = new THREE.OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.05;

const ambientLight = new THREE.AmbientLight(0xffffff, 0.4); 
scene.add(ambientLight);
const dirLight = new THREE.DirectionalLight(0xffffff, 0.6);
dirLight.position.set(5, 10, 7);
scene.add(dirLight);

new THREE.RGBELoader()
    .setDataType(THREE.UnsignedByteType)
    .load('https://cdn.jsdelivr.net/gh/mrdoob/three.js@r128/examples/textures/equirectangular/royal_esplanade_1k.hdr', function (texture) {
        const pmremGenerator = new THREE.PMREMGenerator(renderer);
        pmremGenerator.compileEquirectangularShader();
        const envMap = pmremGenerator.fromEquirectangular(texture).texture;
        scene.environment = envMap; 
        texture.dispose();
        pmremGenerator.dispose();
    });

const gltfLoader = new THREE.GLTFLoader();
const objLoader = new THREE.OBJLoader();
const mtlLoader = new THREE.MTLLoader();
const fbxLoader = new THREE.FBXLoader();

let model, mixer, interactTimeout;
let basePositionY = 0; 
const clock = new THREE.Clock();
const loadingScreen = document.getElementById('loading-screen');
const loadingText = document.getElementById('loading-text');

function clearCurrentModel() {
    if (model) {
        scene.remove(model);
        model.traverse((child) => {
            if (child.isMesh) {
                child.geometry.dispose();
                if (child.material) {
                    Array.isArray(child.material) ? child.material.forEach(mat => mat.dispose()) : child.material.dispose();
                }
            }
        });
        model = null;
    }
    if (mixer) { mixer.stopAllAction(); mixer = null; }
}

function centerAndScaleModel(loadedModel) {
    loadedModel.position.set(0, 0, 0);
    loadedModel.scale.set(1, 1, 1);
    loadedModel.updateMatrixWorld();

    const box = new THREE.Box3().setFromObject(loadedModel);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());

    loadedModel.position.x -= center.x;
    loadedModel.position.y -= center.y;
    loadedModel.position.z -= center.z;

    const maxDim = Math.max(size.x, size.y, size.z);
    if (maxDim > 0) {
        const scaleFactor = 5 / maxDim;
        loadedModel.scale.set(scaleFactor, scaleFactor, scaleFactor);
    }
    loadedModel.updateMatrixWorld(); 

    basePositionY = loadedModel.position.y;
    document.getElementById('y-slider').value = 0; 

    controls.target.set(0, 0, 0); 
    camera.position.set(0, 3, 8);
    controls.update();
}

const showLoading = () => { loadingScreen.style.display = 'flex'; loadingScreen.style.opacity = '1'; loadingText.textContent = translations[currentLang].loading; };
const hideLoading = () => { loadingScreen.style.opacity = '0'; setTimeout(() => loadingScreen.style.display = 'none', 500); };
const onProgress = (xhr) => { if (xhr.lengthComputable) loadingText.textContent = `${translations[currentLang].loading} ${Math.round((xhr.loaded/xhr.total)*100)}%`; };
const onError = (error) => { console.error(error); loadingText.textContent = translations[currentLang].error; setTimeout(hideLoading, 3000); };

function loadModel(url, explicitExtension = null) {
    clearCurrentModel();
    showLoading();
    const fileExt = explicitExtension || url.split('.').pop().toLowerCase();

    const processLoadedModel = (loadedScene) => {
        model = loadedScene;
        centerAndScaleModel(model); 
        scene.add(model);
        hideLoading();
    };

    switch (fileExt) {
        case 'glb': case 'gltf':
            gltfLoader.load(url, (gltf) => {
                processLoadedModel(gltf.scene);
                if (gltf.animations.length) { mixer = new THREE.AnimationMixer(model); mixer.clipAction(gltf.animations[0]).play(); }
            }, onProgress, onError); break;
        case 'obj': objLoader.load(url, processLoadedModel, onProgress, onError); break;
        case 'fbx': fbxLoader.load(url, processLoadedModel, onProgress, onError); break;
        default: alert('Format not supported!'); hideLoading();
    }
}

function loadObjWithMtl(objUrl, mtlUrl) {
    clearCurrentModel();
    showLoading();
    mtlLoader.load(mtlUrl, (materials) => {
        materials.preload();
        objLoader.setMaterials(materials);
        objLoader.load(objUrl, (obj) => {
            model = obj;
            centerAndScaleModel(model);
            scene.add(model);
            hideLoading();
        }, onProgress, onError);
    }, undefined, onError);
}

const toggleGridBtn = document.getElementById('toggle-grid');
toggleGridBtn.addEventListener('click', () => {
    gridHelper.visible = !gridHelper.visible;
    toggleGridBtn.textContent = gridHelper.visible ? translations[currentLang].hideGrid : translations[currentLang].showGrid;
});

const toggleUIBtn = document.getElementById('toggle-ui');
const topPanel = document.getElementById('top-panel');
const uiPanel = document.getElementById('ui-panel');

toggleUIBtn.addEventListener('click', () => {
    uiVisible = !uiVisible;
    if (uiVisible) {
        topPanel.style.display = 'flex'; uiPanel.style.display = 'flex';
        setTimeout(() => {
            topPanel.style.opacity = '1'; topPanel.style.transform = 'translateX(-50%) translateY(0)';
            uiPanel.style.opacity = '1'; uiPanel.style.transform = 'translateX(-50%) translateY(0)';
        }, 10);
        toggleUIBtn.textContent = translations[currentLang].hideUI;
    } else {
        topPanel.style.opacity = '0'; topPanel.style.transform = 'translateX(-50%) translateY(-20px)';
        uiPanel.style.opacity = '0'; uiPanel.style.transform = 'translateX(-50%) translateY(20px)';
        setTimeout(() => { topPanel.style.display = 'none'; uiPanel.style.display = 'none'; }, 400);
        toggleUIBtn.textContent = translations[currentLang].showUI;
    }
});

document.getElementById('y-slider').addEventListener('input', function(e) {
    if (model) model.position.y = basePositionY + parseFloat(e.target.value);
});

document.getElementById('fov-slider').addEventListener('input', function(e) {
    camera.fov = parseFloat(e.target.value);
    camera.updateProjectionMatrix(); 
});

document.getElementById('screenshot-btn').addEventListener('click', () => {
    renderer.render(scene, camera); 
    const link = document.createElement('a');
    link.download = '3d_model.png'; 
    link.href = renderer.domElement.toDataURL('image/png');
    link.click();
});

document.getElementById('bg-selector').addEventListener('change', function(e) {
    scene.background = new THREE.Color(e.target.value);
    document.body.style.backgroundColor = e.target.value;
});

document.getElementById('model-selector').addEventListener('change', function() {
    if (this.value === 'obj-mtl') loadObjWithMtl(this.options[this.selectedIndex].getAttribute('data-obj'), this.options[this.selectedIndex].getAttribute('data-mtl'));
    else if (this.value) loadModel(this.value);
});

document.getElementById('upload-trigger').addEventListener('click', () => document.getElementById('file-input').click());
document.getElementById('file-input').addEventListener('change', function(e) {
    const file = e.target.files[0];
    if (!file) return;
    loadModel(URL.createObjectURL(file), file.name.split('.').pop().toLowerCase());
    document.getElementById('model-selector').selectedIndex = 0;
});

const rotateBtn = document.getElementById('toggle-rotate');
rotateBtn.addEventListener('click', () => {
    autoRotate = !autoRotate;
    rotateBtn.textContent = autoRotate ? translations[currentLang].stopRotate : translations[currentLang].startRotate;
});

controls.addEventListener('start', () => { if(autoRotate) clearTimeout(interactTimeout); });
controls.addEventListener('end', () => { if(autoRotate) interactTimeout = setTimeout(()=>{}, 3000); });

window.addEventListener('resize', () => {
    renderer.setSize(window.innerWidth, window.innerHeight);
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
});

function animate() {
    requestAnimationFrame(animate);
    const delta = clock.getDelta();

    if (autoRotate && model && !controls.state) model.rotation.y += 0.3 * delta; 
    if (mixer) mixer.update(delta);

    controls.update();
    renderer.render(scene, camera);
}

setLanguage('ar');
animate();