const CATALOGO = [
    { id: 'g8', titulo: 'Matemáticas 8°', filename: 'MT_Grado08_2012.pdf' }
];

let db;
let pdfDoc = null;
let scale = 1.2;

// Iniciar Base de Datos IndexedDB
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

function refreshUI() {
    const catalogGrid = document.getElementById('catalog-grid');
    const libraryGrid = document.getElementById('my-library-grid');
    
    const tx = db.transaction(['pdfs'], 'readonly');
    const store = tx.objectStore('pdfs');
    
    store.getAll().onsuccess = (e) => {
        const saved = e.target.result;
        const savedIds = saved.map(b => b.id);
        
        // Mostrar libros guardados
        libraryGrid.innerHTML = saved.length ? '' : '<p>No tienes libros aún. Descarga uno abajo.</p>';
        saved.forEach(book => {
            libraryGrid.innerHTML += `
                <div class="pdf-card">
                    <div style="font-size: 3em;">📘</div>
                    <strong>${book.titulo}</strong><br>
                    <button class="read-btn" onclick="openBook('${book.id}')">Leer ahora</button>
                    <button class="delete-btn" onclick="deleteBook('${book.id}')">Eliminar</button>
                </div>`;
        });

        // Mostrar catálogo disponible
        catalogGrid.innerHTML = '';
        CATALOGO.forEach(book => {
            if (!savedIds.includes(book.id)) {
                catalogGrid.innerHTML += `
                    <div class="pdf-card" id="card-${book.id}">
                        <div style="font-size: 3em;">📗</div>
                        <strong>${book.titulo}</strong><br>
                        <div id="status-${book.id}">
                            <button class="download-btn" onclick="downloadBook('${book.id}')">Descargar</button>
                        </div>
                    </div>`;
            }
        });
    };
}



async function downloadBook(id) {
    const book = CATALOGO.find(b => b.id === id);
    const statusDiv = document.getElementById(`status-${id}`);
    
    // Mínimo cambio: indicar que empezó la descarga
    statusDiv.innerHTML = "Descargando...";

    try {
        const response = await fetch(`./libros/${book.filename}`);
        if (!response.ok) throw new Error('Error de conexión');

        // Mínimo cambio: Obtener los datos directamente sin usar 'while' ni 'reader'
        const arrayBuffer = await response.arrayBuffer();
        
        const tx = db.transaction(['pdfs'], 'readwrite');
        tx.objectStore('pdfs').put({ id: book.id, titulo: book.titulo, data: arrayBuffer });
        tx.oncomplete = () => refreshUI();

    } catch (error) {
        alert("Error: Revisa tu conexión.");
        refreshUI();
    }
}

function deleteBook(id) {
    if(confirm('¿Quieres borrar este libro de tu memoria?')) {
        const tx = db.transaction(['pdfs'], 'readwrite');
        tx.objectStore('pdfs').delete(id);
        tx.oncomplete = () => refreshUI();
    }
}

async function openBook(id) {
    const tx = db.transaction(['pdfs'], 'readonly');
    tx.objectStore('pdfs').get(id).onsuccess = async (e) => {
        const bookData = e.target.result.data;
        pdfDoc = await pdfjsLib.getDocument({ data: bookData }).promise;

        const total = pdfDoc.numPages;
        let central = parseInt(prompt(`El libro tiene ${total} páginas. ¿A qué página quieres ir?`, "1"));

        if (isNaN(central) || central < 1 || central > total) central = 1;

        // Calcular rango: 2 antes y 2 después
        const inicio = Math.max(1, central - 2);
        const fin = Math.min(total, central + 5);

        document.getElementById('pdfModal').style.display = 'block';
        
        // Renderizamos el bloque
        renderRange(inicio, fin, central);
    };
}

async function renderRange(inicio, fin, seleccionada) {
    const viewer = document.getElementById('pdfViewer');
    viewer.innerHTML = '<p style="color:white; text-align:center; padding:20px;">Preparando bloque de páginas...</p>';
    
    const container = document.createDocumentFragment();

    for (let i = inicio; i <= fin; i++) {
        const page = await pdfDoc.getPage(i);
        const viewport = page.getViewport({ scale: scale });
        
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.height = Math.floor(viewport.height);
        canvas.width = Math.floor(viewport.width);
        
        // Añadir un margen y estilo para separar páginas
        canvas.style.marginBottom = "20px";
        canvas.style.display = "block";
        
        // Resaltar la página que el usuario pidió originalmente
        if (i === seleccionada) {
            canvas.style.border = "5px solid #9333ea"; 
        }

        await page.render({ canvasContext: context, viewport: viewport }).promise;
        
        // Etiqueta de número de página
        const label = document.createElement('div');
        label.style.cssText = "color: #ccc; text-align: center; margin-bottom: 10px; font-size: 12px;";
        label.innerText = `Página ${i}`;
        
        container.appendChild(label);
        container.appendChild(canvas);
    }
    
    viewer.innerHTML = '';
    viewer.appendChild(container);
    
    // Auto-scroll a la página seleccionada si no es la primera del bloque
    if (seleccionada > inicio) {
        setTimeout(() => {
            const selectedCanvas = viewer.querySelectorAll('canvas')[seleccionada - inicio];
            selectedCanvas.scrollIntoView({ behavior: 'smooth' });
        }, 500);
    }
}

document.getElementById('closeModal').onclick = () => document.getElementById('pdfModal').style.display = 'none';
document.getElementById('zoomIn').onclick = () => { scale += 0.2; renderAllPages(); };
document.getElementById('zoomOut').onclick = () => { if (scale > 0.6) { scale -= 0.2; renderAllPages(); } };