import { openaiConfig } from "https://cdn.jsdelivr.net/npm/bootstrap-llm-provider@1";
import { bootstrapAlert } from "https://cdn.jsdelivr.net/npm/bootstrap-alert@1";

const DEFAULT_BASE_URLS = [
    "https://openrouter.ai/api/v1", "https://llmfoundry.straivedemo.com/openrouter/v1"
];

const VIEWING_ANGLES = [
    { name: "Front View", prompt: "front view, straight-on perspective, centered composition, clear front-facing details" },
    { name: "Side View", prompt: "side view, profile perspective, lateral angle, showing depth and side details" },
    { name: "Top View", prompt: "top-down view, bird's eye perspective, overhead angle, showing complete layout" },
    { name: "45° Perspective", prompt: "45-degree angle perspective view, three-quarter view, isometric-style angle" }
];

let state = {
    uploadedImages: [],
    generatedImages: [],
    availableModels: [],
    selectedModel: null,
    isGenerating: false,
    generationHistory: [],
    hasGeneratedImages: false
};

const $ = id => document.getElementById(id);
const imageToBase64 = file => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
});

const showAlert = (title, body, color = "info") => bootstrapAlert({ title, body, color });
const toggleLoading = (show, message = "Generating 3D images...", details = "This may take 30-60 seconds") => {
    const overlay = $('loading-overlay');
    if (show) {
        $('loading-message').textContent = message;
        $('loading-details').textContent = details;
        overlay.style.display = 'flex';
        state.isGenerating = true;
    } else {
        overlay.style.display = 'none';
        state.isGenerating = false;
    }
};

const updateLoadingMessage = message => {
    if (state.isGenerating) $('loading-message').textContent = message;
};

const updateGenerationStatus = (message, isVisible = true) => {
    const statusElement = $('generation-status');
    const statusText = $('status-text');
    if (statusText) statusText.textContent = message;
    if (statusElement) { statusElement.style.display = isVisible ? 'block' : 'none';  }
};

const updateGenerateButton = () => {
    const generateBtn = $('generate-btn');
    const generateBtnText = $('generate-btn-text');
    generateBtnText.textContent = state.hasGeneratedImages ? 'Refine Images' : 'Generate 3D Images';
    generateBtn.className = `btn ${state.hasGeneratedImages ? 'btn-warning' : 'btn-primary'} w-100`;
    generateBtn.innerHTML = `<i class="bi bi-${state.hasGeneratedImages ? 'arrow-clockwise' : 'magic'}"></i> <span id="generate-btn-text">${state.hasGeneratedImages ? 'Refine Images' : 'Generate 3D Images'}</span>`;
};

const loadModels = async () => {
    try {
        const config = await openaiConfig({ defaultBaseUrls: DEFAULT_BASE_URLS });
        if (!config.models?.length) return;
        const filterModels = models => models.filter(m => /gemini|gpt-4|claude/i.test(m));
        const recommendedModel = "google/gemini-2.5-flash-image-preview";
        state.availableModels = filterModels(config.models).sort((a, b) => (b === recommendedModel) - (a === recommendedModel));
        const select = $('model-select');
        if (!select) return;
        select.innerHTML = '<option value="">Select Model...</option>' + 
            state.availableModels.map(model => 
                `<option value="${model}">${model}${model === recommendedModel ? ' (Recommended)' : ''}</option>`
            ).join('');
        if (!state.selectedModel) {
            state.selectedModel = state.availableModels.find(m => m === recommendedModel) || state.availableModels[0];
            if (state.selectedModel) select.value = state.selectedModel;
        }
    } catch (error) {
        showAlert("Model Loading Error", "Failed to load available models.", "warning");
    }
};

const generateImageWithAPI = async ({ prompt, imageBase64, systemPrompt, angle }) => {
    const { apiKey, baseUrl } = await openaiConfig({ defaultBaseUrls: DEFAULT_BASE_URLS });
    if (!apiKey) throw new Error('OpenAI API key missing. Please configure your key.');
    const model = state.selectedModel || "google/gemini-2.5-flash-image-preview";
    const fullPrompt = `${systemPrompt}\n\nUser Request: ${prompt}\n\nSpecific View: Generate this from a ${angle.prompt}. Ensure the 3D representation looks realistic and scientifically accurate.`;
    const messages = [{
        role: "user",
        content: [{type:"text",text: fullPrompt},{type: "image_url",image_url:{ url: imageBase64 } }]
    }];

    const response = await fetch(`${baseUrl}/chat/completions`, {
        method: "POST",
        headers: {"Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` },
        body: JSON.stringify({ model, messages })
    });
    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API request failed (${response.status}): ${errorText}`);
    }
    const data = await response.json();
    const message = data.choices?.[0]?.message;
    if (!message) throw new Error('No message received from API');
    if (message.images?.[0]?.image_url?.url) return message.images[0].image_url.url;
    if (message.content?.includes('data:image')) return message.content;
    if (message.content) throw new Error(`No image generated. API returned: ${message.content.substring(0, 200)}...`);
    throw new Error('No image or content received from API');
};

const createImagePreview = (file, containerId) => {
    const reader = new FileReader();
    reader.onload = e => {
        const container = $(containerId);
        if (!container) return;
        const imageDiv = document.createElement('div');
        imageDiv.className = 'border rounded p-2 mb-2 d-flex align-items-center';
        imageDiv.dataset.fileName = file.name;
        imageDiv.innerHTML = `
            <img src="${e.target.result}" class="preview-image me-3" style="max-height: 60px;">
            <div class="flex-grow-1">
                <small class="text-muted d-block">${file.name}</small>
                <small class="text-muted">${(file.size / 1024).toFixed(1)} KB</small>
            </div>
            <button class="btn btn-outline-danger btn-sm" onclick="removeImage('${file.name}')">
                <i class="bi bi-trash"></i>
            </button>
        `;
        container.appendChild(imageDiv);
    };
    reader.readAsDataURL(file);
};

const handleFiles = (files) => {
    Array.from(files).forEach(file => {
        if (file.type.startsWith('image/')) {
            state.uploadedImages.push(file);
            createImagePreview(file, 'image-previews');
        }
    });
};

const setupFileUpload = () => {
    const fileInput = $('file-input');
    if (fileInput) {
        fileInput.addEventListener('change', e => {
            handleFiles(e.target.files);
        });
    }
};

window.removeImage = (fileName) => {
    state.uploadedImages = state.uploadedImages.filter(file => file.name !== fileName);
    const container = $('image-previews');
    if (container) {
        container.innerHTML = '';
        state.uploadedImages.forEach(file => createImagePreview(file, 'image-previews'));
    }
};

const createImageCard = (result, index) => {
    const col = document.createElement('div');
    col.className = 'col-md-6 col-lg-3 mb-3';
    col.innerHTML = `
        <div class="image-card">
            <div class="angle-badge">${result.angle}</div>
            <img src="${result.imageUrl}" class="result-image cursor-pointer"
                 onclick="openImageModal('${result.imageUrl}', '${result.angle}')">
            <div class="mt-2 text-center">
                <button class="btn btn-outline-primary btn-sm" onclick="downloadImage('${result.imageUrl}', '${result.angle}')">
                    <i class="bi bi-download"></i>
                </button>
            </div>
        </div>
    `;
    return col;
};

const displayResults = (results, isRefinement = false) => {
    const container = $('results-container');
    if (!isRefinement) container.innerHTML = '';
    const resultSet = document.createElement('div');
    resultSet.className = 'result-set mb-4';
    resultSet.innerHTML = `
        <div class="mb-3">
            <h6 class="mb-0">${isRefinement ? 'Refined' : 'Generated'} Images</h6>
        </div>
        <div class="row" id="result-row-${state.generatedImages.length}"></div>
    `;
    container.appendChild(resultSet);
    const resultRow = resultSet.querySelector('.row');
    results.forEach((result, index) => {
        resultRow.appendChild(createImageCard(result, index));
    });
    state.generatedImages.push(results);
    state.hasGeneratedImages = true;
    updateGenerateButton();
};

window.openImageModal = (imageUrl, angle) => {
    $('modal-image').src = imageUrl;
    $('modal-image').alt = angle;
    document.querySelector('#imageModal .modal-title').textContent = `${angle} - 3D Generated Image`;
    $('download-modal-image').onclick = () => downloadImage(imageUrl, angle);
    new bootstrap.Modal($('imageModal')).show();
};

window.downloadImage = (imageUrl, angle) => {
    const link = document.createElement('a');
    link.href = imageUrl;
    link.download = `3d-${angle.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};

const generateImages = async () => {
    const userPrompt = $('user-prompt').value.trim();
    const systemPrompt = $('system-prompt').value.trim();
    const multipleAngles = $('multiple-angles').checked;
    try {
        toggleLoading(true);
        const angles = multipleAngles ? VIEWING_ANGLES : [VIEWING_ANGLES[0]];
        const sourceImage = state.uploadedImages[state.uploadedImages.length - 1];
        const imageBase64 = await imageToBase64(sourceImage);
        updateLoadingMessage(`Generating ${angles.length} images in batch...`);
        const batchPromises = angles.map(angle => 
            generateImageWithAPI({
                prompt: userPrompt,
                imageBase64,
                systemPrompt,
                angle
            }).then(imageUrl => ({ imageUrl, angle: angle.name, prompt: userPrompt }))
            .catch(error => {
                console.error(`Failed to generate ${angle.name}:`, error);
                return null;
            })
        );
        const results = (await Promise.all(batchPromises)).filter(result => result !== null);
        if (results.length > 0) {
            const isRefinement = state.hasGeneratedImages;
            displayResults(results, isRefinement);
            $('user-prompt').value = '';
            showAlert("Success", `Generated ${results.length} 3D image${results.length > 1 ? 's' : ''} successfully!`, "success");
        } else {
            throw new Error('No images were generated successfully');
        }
    } catch (error) {
        showAlert("Generation Error", error.message, "danger");
    } finally {
        toggleLoading(false);
    }
};

const setupEventListeners = () => {
    const elements = {
        'config-btn': () => openaiConfig({ defaultBaseUrls: DEFAULT_BASE_URLS, show: true }).then(loadModels),
        'model-select': e => state.selectedModel = e.target.value,
        'generation-form': e => { e.preventDefault(); generateImages(); },
    };
    Object.entries(elements).forEach(([id, handler]) => {
        const element = $(id);
        if (element) {
            const eventType = element.tagName === 'FORM' ? 'submit' :
                             element.tagName === 'SELECT' ? 'change' : 'click';
            element.addEventListener(eventType, handler);
        }
    });
};

const initializeApp = async () => {
    setupFileUpload();
    setupEventListeners();
    await loadModels();
    updateGenerationStatus("Ready for new generation", false);
};
initializeApp();