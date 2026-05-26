// 1. Estructura de Datos Organizada por Grado y Categoría
const DATA_EDUCATIVA = {
    "octavo": {
        "actividades": [
            { id: '8a1', titulo: 'Taller: Ecuaciones Lineales', filename: '8_taller_ecuaciones.pdf' },
            { id: '8a2', titulo: 'Guía: Polígonos', filename: '8_guia_poligonos.pdf' }
        ],
        "calificaciones": [
            { id: '8c1', titulo: 'Notas 1er Periodo - 8°', filename: '8_notas_p1.pdf' }
        ]
    },
    "noveno": {
        "actividades": [
            { id: '9a1', titulo: 'Taller: Funciones Cuadráticas', filename: '9_taller_funciones.pdf' },
            { id: '9a2', titulo: 'Guía: Sistemas 2x2', filename: '9_guia_sistemas.pdf' }
        ],
        "calificaciones": [
            { id: '9c1', titulo: 'Notas 1er Periodo - 9°', filename: '9_notas_p1.pdf' }
        ]
    }
};

let db;
let pdfDoc = null;
let scale = 1.2;
let gradoActual = 'octavo'; // Estado inicial

// 2. Iniciar Base de Datos IndexedDB
const request = indexedDB.open('BiblioKidsDB', 1);

request.onupgradeneeded = (e) => {
    const dbInstance = e.target.result;
    if (!dbInstance.objectStoreNames.contains('pdfs')) {
        dbInstance.createObjectStore('pdfs', { keyPath: 'id' });
    }
};

request.onsuccess = (e) => {
    db = e.target.result;
    refreshUI();
};

// 3. Navegación entre Grados
function switchGrado(grado) {
    gradoActual = grado;
    
    // Feedback visual en botones
    document.querySelectorAll('.tabs button').forEach(btn => {
        btn.classList.remove('active');
    });
    event.currentTarget.classList.add('active');
    
    refreshUI();
}

// 4. Lógica de Interfaz Principal
function refreshUI() {
    const libraryGrid = document.getElementById('my-library-grid');
    const gridActividades = document.getElementById('grid-actividades');
    const gridCalificaciones = document.getElementById('grid-calificaciones');
    
    const tx = db.transaction(['pdfs'], 'readonly');
    const store = tx.objectStore('pdfs');
    
    store.getAll().onsuccess = (e) => {
        const saved = e.target.result;
        const savedIds = saved.map(b => b.id);
        
        // Renderizar Biblioteca Offline (Archivos ya descargados)
        libraryGrid.innerHTML = saved.length ? '' : '<p class="empty-msg">No tienes archivos descargados aún.</p>';
        saved.forEach(book => {
            libraryGrid.innerHTML += `
                <div class="pdf-card saved">
                    <div style="font-size: 2.5em;">📘</div>
                    <strong>${book.titulo}</strong>
                    <button class="read-btn" onclick="openBook('${book.id}')">Leer ahora</button>
                    <button class="delete-btn" onclick="deleteBook('${book.id}')">Eliminar</button>
                </div>`;
        });

        // Renderizar Catálogo (Lo que está disponible para descargar)
        renderFolder(DATA_EDUCATIVA[gradoActual].actividades, gridActividades, savedIds, '📗');
        renderFolder(DATA_EDUCATIVA[gradoActual].calificaciones, gridCalificaciones, savedIds, '📊');
    };
}

function renderFolder(items, container, savedIds, emoji) {
    container.innerHTML = '';
    if (items.length === 0) {
        container.innerHTML = '<p>No hay archivos en esta carpeta.</p>';
        return;
    }

    items.forEach(item => {
        // Solo mostrar en el catálogo si NO ha sido descargado
        if (!savedIds.includes(item.id)) {
            container.innerHTML += `
                <div class="pdf-card" id="card-${item.id}">
                    <div style="font-size: 2.5em;">${emoji}</div>
                    <strong>${item.titulo}</strong>
                    <div id="status-${item.id}">
                        <button class="download-btn" onclick="downloadFile('${item.id}')">Descargar</button>
                    </div>
                </div>`;
        }
    });
}

// 5. Gestión de Descargas (Guardar en IndexedDB)
async function downloadFile(id) {
    // Buscar el item en cualquier grado/categoría
    let fileInfo = null;
    for (const grado in DATA_EDUCATIVA) {
        for (const cat in DATA_EDUCATIVA[grado]) {
            const found = DATA_EDUCATIVA[grado][cat].find(f => f.id === id);
            if (found) fileInfo = found;
        }
    }

    const statusDiv = document.getElementById(`status-${id}`);
    
    try {
        // IMPORTANTE: Asegúrate de que tus archivos estén en la carpeta /libros/
        const response = await fetch(`./libros/${fileInfo.filename}`);
        if (!response.ok) throw new Error('Error de conexión');

        const reader = response.body.getReader();
        const contentLength = +response.headers.get('Content-Length');
        
        let receivedLength = 0;
        let chunks = []; 
        
        while(true) {
            const {done, value} = await reader.read();
            if (done) break;
            chunks.push(value);
            receivedLength += value.length;
            
            if (contentLength) {
                const percent = Math.round((receivedLength / contentLength) * 100);
                statusDiv.innerHTML = `
                    <div class="progress-bar">
                        <div class="progress-fill" style="width: ${percent}%"></div>
                    </div>`;
            }
        }

        const blob = new Blob(chunks);
        const arrayBuffer = await blob.arrayBuffer();
        
        const tx = db.transaction(['pdfs'], 'readwrite');
        tx.objectStore('pdfs').put({ 
            id: fileInfo.id, 
            titulo: fileInfo.titulo, 
            data: arrayBuffer,
            grado: gradoActual 
        });
        
        tx.oncomplete = () => refreshUI();

    } catch (error) {
        alert("No se pudo descargar. Verifica tu internet.");
        refreshUI();
    }
}

// 6. Funciones del Visor y Borrado
function deleteBook(id) {
    if(confirm('¿Eliminar este archivo de la memoria del celular?')) {
        const tx = db.transaction(['pdfs'], 'readwrite');
        tx.objectStore('pdfs').delete(id);
        tx.oncomplete = () => refreshUI();
    }
}

async function openBook(id) {
    const tx = db.transaction(['pdfs'], 'readonly');
    tx.objectStore('pdfs').get(id).onsuccess = async (e) => {
        const bookData = e.target.result.data;
        document.getElementById('pdfModal').style.display = 'block';
        
        // Carga el PDF usando PDF.js
        pdfDoc = await pdfjsLib.getDocument({ data: bookData }).promise;
        renderAllPages();
    };
}

async function renderAllPages() {
    const viewer = document.getElementById('pdfViewer');
    viewer.innerHTML = '<p style="color:white; padding:20px;">Generando vista previa...</p>';
    const pagesContainer = document.createDocumentFragment();
    
    for (let i = 1; i <= pdfDoc.numPages; i++) {
        const page = await pdfDoc.getPage(i);
        const viewport = page.getViewport({ scale: scale });
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.height = viewport.height;
        canvas.width = viewport.width;
        
        await page.render({ canvasContext: context, viewport: viewport }).promise;
        pagesContainer.appendChild(canvas);
    }
    viewer.innerHTML = '';
    viewer.appendChild(pagesContainer);
}

// 7. Controles del Modal
document.getElementById('closeModal').onclick = () => {
    document.getElementById('pdfModal').style.display = 'none';
    pdfDoc = null;
};

document.getElementById('zoomIn').onclick = () => { 
    scale += 0.2; 
    if(pdfDoc) renderAllPages(); 
};

document.getElementById('zoomOut').onclick = () => { 
    if (scale > 0.7) { 
        scale -= 0.2; 
        if(pdfDoc) renderAllPages(); 
    } 
};