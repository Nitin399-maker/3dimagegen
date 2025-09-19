import { openaiConfig } from "https://cdn.jsdelivr.net/npm/bootstrap-llm-provider@1";
import { bootstrapAlert } from "https://cdn.jsdelivr.net/npm/bootstrap-alert@1";

// Constants
const DEFAULT_BASE_URLS = [
    "https://openrouter.ai/api/v1", 
    "https://llmfoundry.straivedemo.com/openrouter/v1"
];

const VIEWING_ANGLES = [
    { name: "Front View", prompt: "front view, straight-on perspective" },
    { name: "Side View", prompt: "side view, profile perspective" },
    { name: "Top View", prompt: "top-down view, bird's eye perspective" },
    { name: "45° Perspective", prompt: "45-degree angle perspective view, three-quarter view" }
];

// Application State
let state = {
    uploadedImages: [],
    referenceImages: [], // Changed to array to handle multiple reference images
    generatedImages: [],
    availableModels: [],
    selectedModel: null,
    isGenerating: false,
    generationHistory: []
};

// Utility Functions
const $ = id => document.getElementById(id);

const imageToBase64 = file => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
});

const showAlert = (title, body, color = "info") => 
    bootstrapAlert({ title, body, color });

// Loading Management
const toggleLoading = (show, message = "Generating 3D images...", details = "This may take 1-2 minutes") => {
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

// Model Management
const filterModels = models => models.filter(model => {
    const m = model.toLowerCase();
    return m.includes("gemini") || m.includes("gpt-4") || m.includes("claude");
});

const updateModelDropdown = () => {
    const select = $('model-select');
    if (!select) return;
    
    select.innerHTML = '<option value="">Select Model...</option>';
    state.availableModels.forEach(model => {
        const option = document.createElement('option');
        option.value = model;
        option.textContent = model + 
            (model.toLowerCase().includes("gemini-2.5-flash-image-preview") ? " (Recommended)" : "");
        select.appendChild(option);
    });
};

const autoSelectModel = () => {
    if (state.selectedModel) return;
    
    state.selectedModel = state.availableModels.find(m =>
        m.toLowerCase().includes("gemini-2.5-flash-image-preview")
    ) || state.availableModels[0];
    
    const select = $('model-select');
    if (select && state.selectedModel) {
        select.value = state.selectedModel;
    }
};

const loadModels = async () => {
    try {
        const config = await openaiConfig({ defaultBaseUrls: DEFAULT_BASE_URLS });
        if (config.models?.length) {
            state.availableModels = filterModels(config.models);
            updateModelDropdown();
            autoSelectModel();
        }
    } catch (error) {
        console.warn('Failed to load models:', error);
        showAlert("Model Loading Error", "Failed to load available models. Please check your API configuration.", "warning");
    }
};

// Image Generation API
const generateImageWithAPI = async ({ prompt, imageBase64, systemPrompt, angle }) => {
    const { apiKey, baseUrl } = await openaiConfig({ defaultBaseUrls: DEFAULT_BASE_URLS });
    
    if (!apiKey) throw new Error('OpenAI API key missing. Please configure your key.');
    
    const model = state.selectedModel || "google/gemini-2.5-flash-image-preview";
    const fullPrompt = `${systemPrompt}\n\nUser Request: ${prompt}\n\nSpecific View: Generate this from a ${angle.prompt}. Ensure the 3D representation looks realistic and scientifically accurate.`;
    
    const messages = [{
        role: "user",
        content: [
            { type: "text", text: fullPrompt },
            { type: "image_url", image_url: { url: imageBase64 } }
        ]
    }];
    
    const response = await fetch(`${baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${apiKey}`,
            "HTTP-Referer": window.location.origin,
            "X-Title": "Scientific Sketch to 3D Converter"
        },
        body: JSON.stringify({ model, messages })
    });
    
    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API request failed (${response.status}): ${errorText}`);
    }
    
    const data = await response.json();
    const message = data.choices?.[0]?.message;
    
    if (!message) throw new Error('No message received from API');
    
    // Extract image URL from response
    if (message.images?.[0]?.image_url?.url) return message.images[0].image_url.url;
    if (message.content?.includes('data:image')) return message.content;
    if (message.content) throw new Error(`No image generated. API returned: ${message.content.substring(0, 200)}...`);
    
    throw new Error('No image or content received from API');
};

// File Upload Management
const createImagePreview = (file, containerId, isReference = false) => {
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
                ${isReference ? '<span class="badge bg-info ms-2">Reference</span>' : ''}
            </div>
            <button class="btn btn-outline-danger btn-sm" onclick="removeImage('${file.name}', ${isReference})">
                <i class="bi bi-trash"></i>
            </button>
        `;
        container.appendChild(imageDiv);
    };
    reader.readAsDataURL(file);
};

const updatePreviewContainer = (containerId, images, isReference = false) => {
    const container = $(containerId);
    if (!container) return;
    
    container.innerHTML = '';
    images.forEach(file => createImagePreview(file, containerId, isReference));
};

const handleFiles = (files, isReference = false) => {
    Array.from(files).forEach(file => {
        if (file.type.startsWith('image/')) {
            if (isReference) {
                state.referenceImages.push(file);
                createImagePreview(file, 'reference-previews', true);
            } else {
                state.uploadedImages.push(file);
                createImagePreview(file, 'image-previews', false);
            }
        }
    });
};

const setupFileUpload = () => {
    // Setup main upload area
    const uploadArea = $('upload-area');
    const fileInput = $('file-input');
    
    if (uploadArea && fileInput) {
        uploadArea.addEventListener('click', () => fileInput.click());
        
        uploadArea.addEventListener('dragover', e => {
            e.preventDefault();
            uploadArea.classList.add('drag-over');
        });
        
        uploadArea.addEventListener('dragleave', () => {
            uploadArea.classList.remove('drag-over');
        });
        
        uploadArea.addEventListener('drop', e => {
            e.preventDefault();
            uploadArea.classList.remove('drag-over');
            handleFiles(e.dataTransfer.files, false);
        });
        
        fileInput.addEventListener('change', e => {
            handleFiles(e.target.files, false);
        });
    }
    
    // Setup reference upload (matches your HTML)
    const referenceUpload = $('reference-upload');
    if (referenceUpload) {
        referenceUpload.addEventListener('change', e => {
            handleFiles(e.target.files, true);
        });
    }
};

// Add reference previews container to the DOM if it doesn't exist
const ensureReferencePreviewsContainer = () => {
    const refinementSection = $('refinement-section');
    if (refinementSection && !$('reference-previews')) {
        const referencePreviewsDiv = document.createElement('div');
        referencePreviewsDiv.id = 'reference-previews';
        referencePreviewsDiv.className = 'mt-3';
        
        // Insert after the file input
        const referenceUpload = $('reference-upload');
        if (referenceUpload && referenceUpload.parentNode) {
            referenceUpload.parentNode.insertBefore(referencePreviewsDiv, referenceUpload.nextSibling);
        }
    }
};

// Global remove function
window.removeImage = (fileName, isReference = false) => {
    if (isReference) {
        state.referenceImages = state.referenceImages.filter(file => file.name !== fileName);
        updatePreviewContainer('reference-previews', state.referenceImages, true);
    } else {
        state.uploadedImages = state.uploadedImages.filter(file => file.name !== fileName);
        updatePreviewContainer('image-previews', state.uploadedImages, false);
    }
};

// Results Display
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
    const timestamp = new Date().toLocaleString();
    
    resultSet.innerHTML = `
        <div class="d-flex justify-content-between align-items-center mb-3">
            <h6 class="mb-0">${isRefinement ? 'Refined' : 'Generated'} Images - ${timestamp}</h6>
            <button class="btn btn-outline-secondary btn-sm compare-btn" onclick="compareImages(${state.generatedImages.length})">
                <i class="bi bi-layout-sidebar"></i> Compare
            </button>
        </div>
        <div class="row" id="result-row-${state.generatedImages.length}"></div>
    `;
    
    container.appendChild(resultSet);
    const resultRow = resultSet.querySelector('.row');
    
    results.forEach((result, index) => {
        resultRow.appendChild(createImageCard(result, index));
    });
    
    state.generatedImages.push(results);
    $('refinement-section').style.display = 'block';
};

// Modal Functions
window.openImageModal = (imageUrl, angle) => {
    $('modal-image').src = imageUrl;
    $('modal-image').alt = angle;
    document.querySelector('#imageModal .modal-title').textContent = `${angle} - 3D Generated Image`;
    $('download-modal-image').onclick = () => downloadImage(imageUrl, angle);
    new bootstrap.Modal($('imageModal')).show();
};

window.compareImages = setIndex => {
    const modal = new bootstrap.Modal($('comparisonModal'));
    const container = $('comparison-container');
    container.innerHTML = '';
    
    if (state.generatedImages[setIndex]) {
        state.generatedImages[setIndex].forEach(result => {
            const col = document.createElement('div');
            col.className = 'col-md-6 col-lg-3 mb-3';
            col.innerHTML = `
                <div class="text-center">
                    <img src="${result.imageUrl}" class="img-fluid rounded">
                    <h6 class="mt-2">${result.angle}</h6>
                </div>
            `;
            container.appendChild(col);
        });
    }
    modal.show();
};

window.downloadImage = (imageUrl, angle) => {
    const link = document.createElement('a');
    link.href = imageUrl;
    link.download = `3d-${angle.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};

// Validation Functions
const validateGenerationInputs = (userPrompt, isRefinement = false) => {
    if (!userPrompt) {
        showAlert("Prompt Required", "Please describe how you want the 3D output to look.", "warning");
        return false;
    }
    
    // For refinement, use reference images if available, otherwise fall back to uploaded images
    // For initial generation, check uploaded images
    const hasRequiredImage = isRefinement ? 
        (state.referenceImages.length > 0 || state.uploadedImages.length > 0) : 
        state.uploadedImages.length > 0;
    
    if (!hasRequiredImage) {
        const message = isRefinement ? 
            "Please upload at least one reference image or ensure you have uploaded initial sketches." : 
            "Please upload at least one sketch image.";
        showAlert("No Images", message, "warning");
        return false;
    }
    
    if (!state.selectedModel) {
        showAlert("No Model Selected", "Please select a model for image generation.", "warning");
        return false;
    }
    
    return true;
};

// Generation Process
const generateImages = async (isRefinement = false) => {
    const promptField = isRefinement ? 'refinement-prompt' : 'user-prompt';
    const userPrompt = $(promptField).value.trim();
    const systemPrompt = $('system-prompt').value.trim();
    const multipleAngles = isRefinement || $('multiple-angles').checked;
    
    if (!validateGenerationInputs(userPrompt, isRefinement)) return;
    
    try {
        toggleLoading(true);
        const results = [];
        const angles = multipleAngles ? VIEWING_ANGLES : [VIEWING_ANGLES[0]];
        
        // For refinement: use reference image if available, otherwise use first uploaded image
        // For initial generation: use first uploaded image
        let sourceImage;
        if (isRefinement && state.referenceImages.length > 0) {
            sourceImage = state.referenceImages[0]; // Use latest reference image
            console.log('Using reference image for refinement:', sourceImage.name);
        } else {
            sourceImage = state.uploadedImages[0]; // Use original uploaded image
            console.log('Using uploaded image:', sourceImage.name);
        }
        
        const imageBase64 = await imageToBase64(sourceImage);
        
        for (let i = 0; i < angles.length; i++) {
            const angle = angles[i];
            updateLoadingMessage(`Generating ${angle.name}... (${i + 1}/${angles.length})`);
            
            try {
                const imageUrl = await generateImageWithAPI({
                    prompt: userPrompt,
                    imageBase64,
                    systemPrompt,
                    angle
                });
                
                results.push({
                    imageUrl,
                    angle: angle.name,
                    prompt: userPrompt
                });
                
                // Add delay between requests
                if (i < angles.length - 1) {
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }
            } catch (error) {
                console.error(`Failed to generate ${angle.name}:`, error);
            }
        }
        
        if (results.length > 0) {
            displayResults(results, isRefinement);
            $(promptField).value = '';
            showAlert("Success", `Generated ${results.length} 3D image${results.length > 1 ? 's' : ''} successfully!`, "success");
        } else {
            throw new Error('No images were generated successfully');
        }
    } catch (error) {
        console.error('Generation error:', error);
        showAlert("Generation Error", error.message, "danger");
    } finally {
        toggleLoading(false);
    }
};

// Event Listeners Setup
const setupEventListeners = () => {
    const elements = {
        'config-btn': () => openaiConfig({ defaultBaseUrls: DEFAULT_BASE_URLS, show: true }).then(loadModels),
        'model-select': e => state.selectedModel = e.target.value,
        'generation-form': e => { e.preventDefault(); generateImages(false); },
        'refinement-form': e => { e.preventDefault(); generateImages(true); },
        'clear-results': () => {
            state.generatedImages = [];
            state.referenceImages = [];
            updatePreviewContainer('reference-previews', [], true);
            $('results-container').innerHTML = `
                <div class="text-center text-muted py-5">
                    <i class="bi bi-image" style="font-size: 4rem;"></i>
                    <h5 class="mt-3">No images generated yet</h5>
                    <p>Upload a sketch and click "Generate 3D Images" to get started</p>
                </div>
            `;
            $('refinement-section').style.display = 'none';
        },
        'download-all': () => {
            state.generatedImages.flat().forEach((result, index) => {
                setTimeout(() => downloadImage(result.imageUrl, `${result.angle}-${index}`), index * 500);
            });
        }
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

// Initialize Application
const initializeApp = async () => {
    ensureReferencePreviewsContainer(); // Ensure reference preview container exists
    setupFileUpload();
    setupEventListeners();
    await loadModels();
    console.log('Scientific Sketch to 3D Converter initialized');
};

// Start the application
initializeApp();