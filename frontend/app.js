// DOM Elements
const dropZone = document.getElementById('dropZone');
const imageInput = document.getElementById('imageInput');
const resultImage = document.getElementById('resultImage');
const placeholder = document.getElementById('placeholder');
const loadingOverlay = document.getElementById('loadingOverlay');

const statTotal = document.getElementById('statTotal');
const statConf = document.getElementById('statConf');
const statTime = document.getElementById('statTime');
const distContainer = document.getElementById('distContainer');
const resultsList = document.getElementById('resultsList');

// Views
const views = {
    dashboard: document.getElementById('view-dashboard'),
    gallery: document.getElementById('view-gallery'),
    analytics: document.getElementById('view-analytics'),
    settings: document.getElementById('view-settings')
};

// Settings
const confRange = document.getElementById('confRange');
const confValue = document.getElementById('confValue');
let currentConf = 0.25;

// State
let history = [];

// --- Initialization ---

async function init() {
    setupNavigation();
    setupDragDrop();
    setupSettings();
    await loadHistory();
    // Default charts
    renderAnalytics();
}

async function loadHistory() {
    try {
        const res = await fetch('http://localhost:8000/history');
        if (res.ok) {
            history = await res.json();
            renderGallery();
            renderAnalytics();
        }
    } catch (e) {
        console.error("Failed to load history", e);
        showToast("Could not load history from backend", "error");
    }
}

function setupNavigation() {
    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach((item, index) => {
        item.addEventListener('click', () => {
            // Update UI
            navItems.forEach(n => n.classList.remove('active'));
            item.classList.add('active');

            // Switch View
            const viewNames = ['dashboard', 'gallery', 'analytics', 'settings'];
            switchView(viewNames[index]);
        });
    });
}

function switchView(viewName) {
    Object.values(views).forEach(el => el.classList.add('hidden'));
    views[viewName].classList.remove('hidden');

    if (viewName === 'gallery') renderGallery();
    if (viewName === 'analytics') renderAnalytics();
}

// --- User Feedback ---

function showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer') || createToastContainer();
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;

    let icon = 'information-circle-outline';
    if (type === 'success') icon = 'checkmark-circle-outline';
    if (type === 'error') icon = 'alert-circle-outline';

    toast.innerHTML = `<ion-icon name="${icon}" style="font-size: 1.5rem;"></ion-icon> <span>${message}</span>`;

    container.appendChild(toast);

    setTimeout(() => {
        toast.style.animation = 'fadeOut 0.3s ease forwards';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

function createToastContainer() {
    const el = document.createElement('div');
    el.id = 'toastContainer';
    el.className = 'toast-container';
    document.body.appendChild(el);
    return el;
}

function setupSettings() {
    let timeout;
    confRange.addEventListener('input', (e) => {
        currentConf = e.target.value / 100;
        confValue.textContent = e.target.value + '%';

        clearTimeout(timeout);
        timeout = setTimeout(() => {
            showToast(`Confidence threshold set to ${e.target.value}%`, 'success');
        }, 500);
    });
}

// --- Drag & Drop ---

function setupDragDrop() {
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, preventDefaults, false);
    });

    ['dragenter', 'dragover'].forEach(eventName => {
        dropZone.addEventListener(eventName, () => dropZone.classList.add('drag-over'), false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, () => dropZone.classList.remove('drag-over'), false);
    });

    dropZone.addEventListener('drop', handleDrop, false);
    imageInput.addEventListener('change', function () { handleFiles(this.files); });
}

function preventDefaults(e) {
    e.preventDefault();
    e.stopPropagation();
}

function handleDrop(e) {
    const dt = e.dataTransfer;
    const files = dt.files;
    handleFiles(files);
}

function handleFiles(files) {
    if (files.length > 0) {
        const file = files[0];
        if (file.type.startsWith('image/')) {
            uploadFile(file);
        } else {
            alert('Please select an image file.');
        }
    }
}

// --- Logic ---

async function uploadFile(file) {
    // Switch to dashboard if not there
    switchView('dashboard');
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    document.querySelectorAll('.nav-item')[0].classList.add('active');

    // UI Loading
    placeholder.classList.add('hidden');
    resultImage.classList.remove('hidden');
    loadingOverlay.classList.remove('hidden');

    // Preview original
    const reader = new FileReader();
    reader.onload = (e) => {
        resultImage.src = e.target.result;
    };
    reader.readAsDataURL(file);

    // API
    const formData = new FormData();
    formData.append("file", file);
    formData.append("conf", currentConf); // Dynamic confidence

    const startTime = performance.now();

    try {
        const response = await fetch("http://localhost:8000/predict", {
            method: "POST",
            body: formData
        });

        if (!response.ok) throw new Error('Prediction failed');

        const data = await response.json();
        const endTime = performance.now();
        const duration = (endTime - startTime).toFixed(0);

        if (data.image) {
            resultImage.src = `data:image/png;base64,${data.image}`;
        }

        updateDashboard(data.detections, duration);

        // Refresh history from backend to get the new entry with persistent ID/URL
        await loadHistory();

    } catch (error) {
        console.error("Error:", error);
        alert("An error occurred during detection.");
        resetApp();
    } finally {
        loadingOverlay.classList.add('hidden');
    }
}

function updateDashboard(detections, durationMs) {
    statTotal.textContent = detections.length;
    statTime.textContent = `${durationMs} ms`;

    if (detections.length === 0) {
        statConf.textContent = "0%";
        distContainer.innerHTML = '<p style="color: var(--text-muted); text-align: center;">No objects detected.</p>';
        resultsList.innerHTML = '';
        return;
    }

    const avgConf = detections.reduce((acc, d) => acc + d.confidence, 0) / detections.length;
    statConf.textContent = `${(avgConf * 100).toFixed(1)}%`;

    renderDistribution(detections, distContainer);
    renderList(detections);
}

function renderDistribution(detections, container) {
    const counts = {};
    detections.forEach(d => {
        counts[d.class_name] = (counts[d.class_name] || 0) + 1;
    });

    container.innerHTML = '<h4 style="margin-bottom: 1rem; font-size: 0.9rem; color: var(--text-muted); text-transform: uppercase;">Class Distribution</h4>';

    const maxCount = Math.max(...Object.values(counts));
    const colors = ['var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)'];

    Object.entries(counts).forEach(([cls, count], index) => {
        const percentage = (count / maxCount) * 100;
        const color = colors[index % colors.length];

        container.innerHTML += `
            <div class="dist-row">
                <div class="dist-header">
                    <span>${cls}</span>
                    <span>${count}</span>
                </div>
                <div class="progress-bar-bg">
                    <div class="progress-bar-fill" style="width: ${percentage}%; background-color: ${color};"></div>
                </div>
            </div>
        `;
    });
}

function renderList(detections) {
    resultsList.innerHTML = '';
    detections.forEach(det => {
        const conf = (det.confidence * 100).toFixed(1);
        resultsList.innerHTML += `
            <div class="obj-list-item">
                <div style="display:flex; flex-direction:column;">
                    <span style="font-weight: 500;">${det.class_name}</span>
                    <span style="font-size: 0.75rem; color: var(--text-muted);">
                        [${det.bbox.map(x => Math.round(x)).join(',')}]
                    </span>
                </div>
                <span class="conf-pill">${conf}%</span>
            </div>
        `;
    });
}

// --- History & Data ---

function renderAnalytics() {
    const globalTotalScans = document.getElementById('globalTotalScans');
    const globalTotalObjects = document.getElementById('globalTotalObjects');
    const globalDistContainer = document.getElementById('globalDistContainer');

    if (history.length === 0) {
        globalTotalScans.textContent = '0';
        globalTotalObjects.textContent = '0';
        globalDistContainer.innerHTML = '<p style="color: var(--text-muted); text-align: center;">No data available.</p>';
        return;
    }

    // Aggregate
    let totalObjects = 0;
    const allDetections = [];

    history.forEach(h => {
        totalObjects += h.detections.length;
        allDetections.push(...h.detections);
    });

    globalTotalScans.textContent = history.length;
    globalTotalObjects.textContent = totalObjects;

    // Advanced Chart
    const counts = {};
    allDetections.forEach(d => {
        counts[d.class_name] = (counts[d.class_name] || 0) + 1;
    });

    const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    const total = allDetections.length;

    let gradientString = '';
    let currentDeg = 0;
    const colors = ['#f472b6', '#22d3ee', '#a78bfa', '#34d399', '#facc15'];

    let legendHTML = '';

    entries.forEach(([cls, count], i) => {
        const pct = total > 0 ? count / total : 0;
        const deg = pct * 360;
        const color = colors[i % colors.length];

        gradientString += `${color} ${currentDeg}deg ${currentDeg + deg}deg, `;
        currentDeg += deg;

        legendHTML += `
            <div class="legend-item">
                <div><span class="legend-color" style="background:${color}"></span>${cls}</div>
                <span style="font-weight:600">${Math.round(pct * 100)}%</span>
            </div>
        `;
    });

    if (gradientString) {
        gradientString = gradientString.slice(0, -2); // remove last comma
    } else {
        gradientString = 'var(--border) 0deg 360deg'; // fallback
    }

    globalDistContainer.innerHTML = `
        <div class="chart-container">
            <div class="chart-circle" style="background: conic-gradient(${gradientString})"></div>
            <div class="chart-legend">
                ${legendHTML}
            </div>
        </div>
    `;
}

function loadFromHistory(item) {
    switchView('dashboard');
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    document.querySelectorAll('.nav-item')[0].classList.add('active');

    placeholder.classList.add('hidden');
    resultImage.classList.remove('hidden');

    if (item.imageUrl) {
        resultImage.src = item.imageUrl;
    } else {
        resultImage.src = `data:image/png;base64,${item.image}`;
    }

    updateDashboard(item.detections, item.duration);
}

async function clearHistory() {
    if (confirm('Are you sure you want to clear all history on the SERVER?')) {
        try {
            await fetch('http://localhost:8000/history', { method: 'DELETE' });
            history = [];
            renderGallery();
            renderAnalytics();
            showToast('Server history cleared successfully.', 'success');
        } catch (e) {
            showToast('Failed to clear history', 'error');
        }
    }
}

function resetApp() {
    placeholder.classList.remove('hidden');
    resultImage.classList.add('hidden');
    resultImage.src = '';
    imageInput.value = '';

    statTotal.textContent = '0';
    statConf.textContent = '0%';
    statTime.textContent = '-- ms';
    distContainer.innerHTML = '<p style="color: var(--text-muted); text-align: center;">Waiting for data...</p>';
    resultsList.innerHTML = '';
}

let webcamStream = null;
const webcamVideo = document.getElementById('webcamFeed');
const captureBtn = document.getElementById('captureBtn');
const webcamBtnText = document.querySelector('#webcamBtn');

async function toggleWebcam() {
    if (webcamStream) {
        stopWebcam();
    } else {
        await startWebcam();
    }
}

async function startWebcam() {
    try {
        // UI State
        placeholder.classList.add('hidden');
        resultImage.parentElement.classList.add('hidden'); // Hide result container
        webcamVideo.classList.remove('hidden');
        captureBtn.classList.remove('hidden');

        webcamStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
        webcamVideo.srcObject = webcamStream;

        webcamBtnText.innerHTML = '<ion-icon name="stop-circle-outline"></ion-icon> Stop Webcam';
        webcamBtnText.classList.add('active'); // Style active state if needed
        showToast("Webcam started", "info");
    } catch (err) {
        console.error(err);
        showToast("Could not access webcam", "error");
    }
}

function stopWebcam() {
    if (webcamStream) {
        webcamStream.getTracks().forEach(track => track.stop());
        webcamStream = null;
        webcamVideo.srcObject = null;
    }
    webcamVideo.classList.add('hidden');
    captureBtn.classList.add('hidden');

    // If no result exists showing, show placeholder
    if (!resultImage.src || resultImage.src === window.location.href) {
        placeholder.classList.remove('hidden');
    } else {
        resultImage.parentElement.classList.remove('hidden');
    }

    webcamBtnText.innerHTML = '<ion-icon name="videocam-outline"></ion-icon> Webcam';
    webcamBtnText.classList.remove('active');
}

function captureWebcam() {
    if (!webcamStream) return;

    // Draw text on canvas
    const canvas = document.createElement('canvas');
    canvas.width = webcamVideo.videoWidth;
    canvas.height = webcamVideo.videoHeight;
    const ctx = canvas.getContext('2d');

    // Mirror if needed, but usually just draw
    // ctx.translate(canvas.width, 0);
    // ctx.scale(-1, 1);
    ctx.drawImage(webcamVideo, 0, 0, canvas.width, canvas.height);

    canvas.toBlob(blob => {
        const file = new File([blob], "webcam_capture.png", { type: "image/png" });
        stopWebcam(); // Stop after capture
        uploadFile(file); // reuse upload logic
    }, 'image/png');
}

function downloadResult() {
    const src = resultImage.src;
    if (!src) return;

    const link = document.createElement('a');
    link.href = src;
    link.download = `yolov8_detection_${Date.now()}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

function filterGallery() {
    const query = document.getElementById('gallerySearch').value.toLowerCase();
    const items = document.querySelectorAll('.gallery-item');

    items.forEach(item => {
        // Need to check the data attached to the item logic or parse the DOM
        // Since we didn't attach data explicitly on DOM, let's look at history array based on index?
        // Better: filtering reconstructs the grid or just hides elements.
        // Let's rely on finding text in 'gallery-stats' is too sparse.
        // Let's re-render the gallery with filter from the 'history' array.
    });

    // Re-render approach
    const filteredHistory = history.filter(h => {
        // Search in class names of detections
        return h.detections.some(d => d.class_name.toLowerCase().includes(query));
    });

    renderGallery(filteredHistory);
}

// Modify renderGallery to accept data arg
function renderGallery(data = history) {
    const grid = document.getElementById('galleryGrid');
    if (data.length === 0) {
        grid.innerHTML = '<p style="color: var(--text-muted);">No matching history found.</p>';
        return;
    }

    grid.innerHTML = '';
    data.forEach(item => {
        const div = document.createElement('div');
        div.className = 'gallery-item';
        const imgParams = item.imageUrl ?
            `src="${item.imageUrl}"` :
            `src="data:image/png;base64,${item.image}"`;

        // Set content first
        div.innerHTML = `
            <img ${imgParams} loading="lazy">
            <div class="gallery-info">
                <div class="gallery-date">${item.date}</div>
                <div class="gallery-stats">
                    <span>${item.detections.length} Objects</span>
                    <span>${item.duration} ms</span>
                </div>
            </div>
        `;

        // Create and add delete button AFTER setting innerHTML
        const deleteBtn = document.createElement('div');
        deleteBtn.className = 'gallery-btn-delete';
        deleteBtn.innerHTML = '<ion-icon name="trash-outline"></ion-icon>';
        deleteBtn.onclick = (e) => {
            console.log('🗑️ Delete button clicked! ID:', item.id);
            e.stopPropagation(); // Prevent card click
            deleteItem(item.id, e);
        };

        console.log('Creating delete button for item:', item.id);

        // Add delete button to the div
        div.insertBefore(deleteBtn, div.firstChild);

        // Card Click - attach to the div but check if click came from delete button
        div.onclick = (e) => {
            // Don't trigger if clicking the delete button
            if (!e.target.closest('.gallery-btn-delete')) {
                loadFromHistory(item);
            }
        };

        grid.appendChild(div);
    });
}

async function deleteItem(id, event) {
    console.log('Requesting delete for ID:', id);
    // event.stopPropagation(); // Don't trigger card click - already handled above or redundant

    // Direct deletion without confirmation as requested


    try {
        const res = await fetch(`http://localhost:8000/history/${id}`, { method: 'DELETE' });
        if (res.ok) {
            // Update local state
            history = history.filter(h => h.id !== id);
            // Re-render
            const query = document.getElementById('gallerySearch').value.toLowerCase();
            if (query) filterGallery();
            else renderGallery();

            renderAnalytics(); // Update stats
            showToast('Item deleted successfully', 'success');
        } else {
            showToast('Failed to delete item', 'error');
        }
    } catch (e) {
        console.error(e);
        showToast('Error deleting item', 'error');
    }
}

// Override switchView to stop webcam
const originalSwitchView = switchView;
switchView = function (viewName) {
    if (webcamStream && viewName !== 'dashboard') stopWebcam();
    originalSwitchView(viewName);
}

// Override uploadFile to ensure webcam hidden
const originalUploadFile = uploadFile;
uploadFile = async function (file) {
    // Stop webcam if running
    if (webcamStream) stopWebcam();

    resultImage.parentElement.classList.remove('hidden'); // Show result container
    webcamVideo.classList.add('hidden');

    await originalUploadFile(file);
}

// Start
init();
