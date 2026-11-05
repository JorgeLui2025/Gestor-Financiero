// ============================================
// VARIABLES GLOBALES
// ============================================
let movimientos = [];
let chartInstance = null;
let graficoGastosInstance = null;
let graficoIngresosInstance = null;


// ============================================
// CONFIGURACIÓN RAG + GEMINI
// ============================================
const GEMINI_API_KEY = "AQ.Ab8RN6LniV2xuKK7MkYNis-jk-L3CCfOmrzRj0GdhOjuABUKJQ";
const GEMINI_MODEL = "gemini-3.6-flash";
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;

// Referencias DOM (Seguras)
const dom = {
  lista: document.getElementById("listaMovimientos"),
  form: document.getElementById("formMovimiento"),
  tipo: document.getElementById("tipo"),
  desc: document.getElementById("descripcion"),
  monto: document.getElementById("monto"),
  fecha: document.getElementById("fecha"),
  valIng: document.getElementById("valIng"),
  valGas: document.getElementById("valGas"),
  valSal: document.getElementById("valSal"),
  ahorradoMeta: document.getElementById("ahorradoMeta"),
  porcentajeMeta: document.getElementById("porcentajeMeta"),
  progreso: document.getElementById("progreso"),
};

// ============================================
// CONEXIÓN FIRESTORE
// ============================================
function conectarYEscucharBaseDeDatos() {
  if (typeof db === "undefined") {
    console.warn("⚠️ Firebase no está inicializado");
    return;
  }

  db.collection("movimientos")
    .orderBy("fecha", "desc")
    
    .onSnapshot(
      (snapshot) => {
        movimientos = [];
        snapshot.forEach((doc) => {
          movimientos.push({ id: doc.id, ...doc.data() });
        });

        actualizarInterfazCompleta();
        console.log(`✅ ${movimientos.length} movimientos sincronizados`);
      },
      (error) => {
        console.error("❌ Error leyendo DB:", error);
        alert("⚠️ Error conectando a Firebase");
      },
    );
}

// ============================================
// AGREGAR MOVIMIENTO
// ============================================
dom.form.addEventListener("submit", async (e) => {
  e.preventDefault();

  const nuevoMovimiento = {
    tipo: dom.tipo.value,
    descripcion: dom.desc.value.trim(),
    monto: parseFloat(dom.monto.value.replace(",", ".")),
    fecha: dom.fecha.value,
  };

  try {
    await db.collection("movimientos").add(nuevoMovimiento);

    dom.desc.value = "";
    dom.monto.value = "";
    dom.fecha.value = new Date().toISOString().split("T")[0];
    dom.tipo.value = "gasto";
  } catch (error) {
    console.error("❌ Error al guardar:", error);
    alert("❌ No se pudo guardar");
  }
});

// ============================================
// ELIMINAR MOVIMIENTO
// ============================================
window.eliminarMovimiento = async function (id) {
  if (!confirm("¿Eliminar permanentemente?")) return;

  try {
    await db.collection("movimientos").doc(id).delete();
  } catch (e) {
    alert("Error: " + e.message);
  }
};

// ============================================
// ACTUALIZAR INTERFAZ COMPLETA
// ============================================
function actualizarInterfazCompleta() {
  renderizarLista();
  calcularTotales();
  generarReporteMensual();
  generarGraficoSaldo();
  generarResumenComparativo();
  generarGraficosEstadisticos();
}

// ============================================
// RENDERIZAR LISTA
// ============================================
function renderizarLista() {
  if (!dom.lista) return;

  dom.lista.innerHTML = "";

  [...movimientos]
    .sort((a, b) => new Date(b.fecha) - new Date(a.fecha))
    .forEach((m) => {
      const li = document.createElement("li");
      li.className = `item-${m.tipo}`;
      li.innerHTML = `
        <div>
          <small style="color:#94a3b8;">${m.fecha}</small><br>
          <strong>${m.descripcion}</strong>
        </div>
        <div style="display:flex; align-items:center; gap:15px;">
          <span style="font-weight:bold; color:${m.tipo === "ingreso" ? "#10b981" : "#b91c1c"}">
            ${m.tipo === "gasto" ? "-" : "+"} S/ ${m.monto.toFixed(2)}
          </span>
          <button onclick="eliminarMovimiento('${m.id}')" class="btn-delete">
            <i class="fas fa-trash"></i>
          </button>
        </div>
      `;
      dom.lista.appendChild(li);
    });
}

// ============================================
// CALCULAR TOTALES
// ============================================
function calcularTotales() {
  const ingresos = movimientos
    .filter((m) => m.tipo === "ingreso")
    .reduce((acc, m) => acc + m.monto, 0);

  const gastos = movimientos
    .filter((m) => m.tipo === "gasto")
    .reduce((acc, m) => acc + m.monto, 0);

  const saldo = ingresos - gastos;

  if (dom.valIng) dom.valIng.textContent = `S/ ${ingresos.toFixed(2)}`;
  if (dom.valGas) dom.valGas.textContent = `S/ ${gastos.toFixed(2)}`;
  if (dom.valSal) dom.valSal.textContent = `S/ ${saldo.toFixed(2)}`;

  const metaTotal = 2500;
  const porcentaje = Math.min((saldo / metaTotal) * 100, 100).toFixed(0);

  if (dom.ahorradoMeta) dom.ahorradoMeta.textContent = `S/ ${saldo.toFixed(2)}`;
  if (dom.porcentajeMeta) dom.porcentajeMeta.textContent = `${porcentaje}%`;
  if (dom.progreso) dom.progreso.style.width = `${porcentaje}%`;
}

// ============================================
// GENERAR RESUMEN COMPARATIVO
// ============================================
function generarResumenComparativo() {
  const container = document.getElementById("listaIngresosHistorico");
  const containerGastos = document.getElementById("listaGastosHistorico");
  const totalIngEl = document.getElementById("totalIngresosHistorico");
  const totalGasEl = document.getElementById("totalGastosHistorico");

  if (!container || !containerGastos) return;

  container.innerHTML = "";
  containerGastos.innerHTML = "";

  const ingresos = movimientos.filter((m) => m.tipo === "ingreso");
  const gastos = movimientos.filter((m) => m.tipo === "gasto");

  const totalIngresos = ingresos.reduce((acc, m) => acc + m.monto, 0);
  const totalGastos = gastos.reduce((acc, m) => acc + m.monto, 0);

  if (totalIngEl) totalIngEl.textContent = `S/ ${totalIngresos.toFixed(2)}`;
  if (totalGasEl) totalGasEl.textContent = `S/ ${totalGastos.toFixed(2)}`;

  ingresos
    .sort((a, b) => new Date(b.fecha) - new Date(a.fecha))
    .forEach((m) => {
      const div = document.createElement("div");
      div.className = "item-movimiento";
      div.innerHTML = `
        <div>
          <div class="item-desc">${m.descripcion}</div>
          <div class="item-fecha">${m.fecha}</div>
        </div>
        <div class="item-monto">+ S/ ${m.monto.toFixed(2)}</div>
      `;
      container.appendChild(div);
    });

  gastos
    .sort((a, b) => new Date(b.fecha) - new Date(a.fecha))
    .forEach((m) => {
      const div = document.createElement("div");
      div.className = "item-movimiento";
      div.innerHTML = `
        <div>
          <div class="item-desc">${m.descripcion}</div>
          <div class="item-fecha">${m.fecha}</div>
        </div>
        <div class="item-monto">- S/ ${m.monto.toFixed(2)}</div>
      `;
      containerGastos.appendChild(div);
    });
}

// ============================================
// AGRUPAR POR PALABRAS CLAVE
// ============================================
function agruparPorPalabrasClave(movimientosLista) {
  const categorias = {
    pasajes: 0,
    comida: 0,
    compras: 0, // ✅ Todo en minúscula
    estudio: 0,
    accesorios: 0, // ✅ Todo en minúscula
    ropa: 0,
    eventos: 0,
    otros: 0, // ✅ "otros" en minúscula
  };
  const palabrasClave = {
    pasajes: [
      "pasaje ",
      "pasajes ",
      "transporte ",
      "carro ",
      "taxi ",
      "viaje ",
      "movilidad ",
    ],
    comida: [
      "comida ",
      "almuerzo ",
      "desayuno ",
      "cena ",
      "cafe ",
      "gaseosa ",
      "keke ",
      "torta ",
      "mercado ",
      "naranja ",
      "frutas ",
      "Gelatina ",
      "dulce ",
      "galleta ",
      "Pan ",
      "pan ",
      "caramelo ",
      "chicle ",
      "alfajores ", // ✅ Corregido "alfafores"
      "bebidas ",
      "Fanta ",
    ],
    compras: ["Temu", "Yape", "Ype", "Ark", "internet"], // ✅ minúscula
    estudio: ["Derecho", "constancia"],
    accesorios: ["Pilas", "Memoria", "mouse", "disco duro", "memoria"], // ✅ minúscula
    ropa: ["ropa", "zapato", "tienda", "vestimenta"],
    eventos: [
      "fiesta",
      "cumpleaños",
      "fotos",
      "video",
      "concierto",
      "alquiler",
      "evento",
      "foto",
    ],
    otros: ["página web", "academia", "clases"], // ✅ minúscula
  };

  movimientosLista.forEach((m) => {
    const desc = m.descripcion.toLowerCase();
    let encontrado = false;
    for (const [categoria, palabras] of Object.entries(palabrasClave)) {
      if (palabras.some((palabra) => desc.includes(palabra))) {
        categorias[categoria] += m.monto;
        encontrado = true;
        break;
      }
    }
    if (!encontrado) {
      categorias["otros"] += m.monto; // ✅ Ahora sí funciona
    }
  });
  return categorias;
}

// ============================================
// GENERAR GRÁFICOS ESTADÍSTICOS - RESPONSIVE
// ============================================
function generarGraficosEstadisticos() {
  generarGraficoGastos();
  generarGraficoIngresos();
  generarTarjetasCategorias();
}

function generarGraficoGastos() {
  const ctx = document.getElementById("graficoGastos");
  if (!ctx) return;

  if (graficoGastosInstance) {
    graficoGastosInstance.destroy();
  }

  const gastosMovimientos = movimientos.filter((m) => m.tipo === "gasto");
  const categorias = agruparPorPalabrasClave(gastosMovimientos);

  const labels = Object.keys(categorias).filter((cat) => categorias[cat] > 0);
  const data = labels.map((cat) => categorias[cat]);
  const total = data.reduce((a, b) => a + b, 0);

  const colores = [
    "#ef4444",
    "#f59e0b",
    "#10b981",
    "#3b82f6",
    "#8b5cf6",
    "#ec4899",
    "#14b8a6",
    "#f97316",
  ];

  graficoGastosInstance = new Chart(ctx, {
    type: "doughnut",
    data: {
      labels: labels.map((l) => l.charAt(0).toUpperCase() + l.slice(1)),
      datasets: [
        {
          data: data,
          backgroundColor: colores.slice(0, labels.length),
          borderWidth: 2,
          borderColor: "#fff",
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: function (context) {
              const label = context.label || "";
              const value = context.parsed || 0;
              const percentage =
                total > 0 ? ((value / total) * 100).toFixed(1) : 0;
              return `${label}: S/ ${value.toFixed(2)} (${percentage}%)`;
            },
          },
        },
      },
    },
  });

  const leyendaContainer = document.getElementById("leyendaGastos");
  if (leyendaContainer) {
    leyendaContainer.innerHTML = labels
      .map(
        (label, i) => `
      <div class="leyenda-item">
        <div class="color-dot" style="background: ${colores[i]}"></div>
        <span>${label.charAt(0).toUpperCase() + label.slice(1)}: S/ ${data[i].toFixed(2)} (${total > 0 ? ((data[i] / total) * 100).toFixed(1) : 0}%)</span>
      </div>
    `,
      )
      .join("");
  }
}

function generarGraficoIngresos() {
  const ctx = document.getElementById("graficoIngresos");
  if (!ctx) return;

  if (graficoIngresosInstance) {
    graficoIngresosInstance.destroy();
  }

  const ingresosMovimientos = movimientos.filter((m) => m.tipo === "ingreso");
  const categorias = agruparPorPalabrasClave(ingresosMovimientos);

  const labels = Object.keys(categorias).filter((cat) => categorias[cat] > 0);
  const data = labels.map((cat) => categorias[cat]);

  const colores = ["#10b981", "#3b82f6", "#8b5cf6", "#f59e0b", "#14b8a6"];

  graficoIngresosInstance = new Chart(ctx, {
    type: "bar",
    data: {
      labels: labels.map((l) => l.charAt(0).toUpperCase() + l.slice(1)),
      datasets: [
        {
          label: "Ingresos",
          data: data,
          backgroundColor: colores.slice(0, labels.length),
          borderRadius: 8,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
      },
      scales: {
        y: {
          beginAtZero: true,
          grid: { color: "#e2e8f0" },
        },
        x: {
          grid: { display: false },
        },
      },
    },
  });

  const leyendaContainer = document.getElementById("leyendaIngresos");
  if (leyendaContainer) {
    leyendaContainer.innerHTML = labels
      .map(
        (label, i) => `
      <div class="leyenda-item">
        <div class="color-dot" style="background: ${colores[i]}"></div>
        <span>${label.charAt(0).toUpperCase() + label.slice(1)}: S/ ${data[i].toFixed(2)}</span>
      </div>
    `,
      )
      .join("");
  }
}

function generarTarjetasCategorias() {
  const container = document.getElementById("categoriasResumen");
  if (!container) return;

  container.innerHTML = "";

  const gastosMovimientos = movimientos.filter((m) => m.tipo === "gasto");
  const categorias = agruparPorPalabrasClave(gastosMovimientos);
  let totalGastos = Object.values(categorias).reduce((a, b) => a + b, 0);

  const iconos = {
    pasajes: "🚌",
    comida: "🍔",
    fiesta: "🎉",
    servicios: "💡",
    estudio: "📚",
    salud: "💊",
    ropa: "👕",
    otros: "📦",
  };

  Object.entries(categorias)
    .filter(([_, monto]) => monto > 0)
    .sort((a, b) => b[1] - a[1])
    .forEach(([cat, monto]) => {
      const porcentaje =
        totalGastos > 0 ? ((monto / totalGastos) * 100).toFixed(1) : 0;
      const icono = iconos[cat] || iconos["otros"];

      const card = document.createElement("div");
      card.className = "categoria-card";
      card.innerHTML = `
        <div class="categoria-icono">${icono}</div>
        <div class="categoria-nombre">${cat.toUpperCase()}</div>
        <div class="categoria-monto">S/ ${monto.toFixed(2)}</div>
        <div class="categoria-porcentaje">${porcentaje}% del total</div>
      `;
      container.appendChild(card);
    });
}

// ============================================
// GENERAR REPORTE MENSUAL
// ============================================
function generarReporteMensual() {
  const container = document.getElementById("reporteMensual");
  if (!container) return;

  container.innerHTML = "";

  const meses = {};
  movimientos.forEach((m) => {
    const mes = m.fecha.substring(0, 7);
    if (!meses[mes]) meses[mes] = { i: 0, g: 0 };
    if (m.tipo === "ingreso") meses[mes].i += m.monto;
    else meses[mes].g += m.monto;
  });

  Object.keys(meses)
    .sort()
    .reverse()
    .forEach((mes) => {
      const [año, mesNum] = mes.split("-");
      const fecha = new Date(parseInt(año), parseInt(mesNum) - 1, 1);
      const nombreMes = fecha.toLocaleString("es-ES", {
        month: "long",
        year: "numeric",
      });

      const bloque = document.createElement("div");
      bloque.className = "bloque-mes";
      bloque.innerHTML = `
        <div class="titulo-mes" onclick="this.nextElementSibling.classList.toggle('mostrar')">
          <div>
            <span>📅 ${nombreMes.toUpperCase()}</span>
            <span>S/ ${(meses[mes].i - meses[mes].g).toFixed(2)}</span>
          </div>
        </div>
        <div class="detalle-mes mostrar">
          <div>
            <div>
              <div>Ingresos: S/ ${meses[mes].i.toFixed(2)}</div>
              <div>Gastos: S/ ${meses[mes].g.toFixed(2)}</div>
            </div>
            <div>
              <span>Saldo Neto</span>
              <span style="color: ${meses[mes].i - meses[mes].g >= 0 ? "#10b981" : "#ef4444"}">
                S/ ${(meses[mes].i - meses[mes].g).toFixed(2)}
              </span>
            </div>
          </div>
        </div>
      `;
      container.appendChild(bloque);
    });
}

// ============================================
// GRÁFICO DE SALDO - RESPONSIVE
// ============================================
function generarGraficoSaldo() {
  const ctx = document.getElementById("graficoSaldo");
  if (!ctx) return;

  if (chartInstance) {
    chartInstance.destroy();
  }

  const meses = {};
  movimientos.forEach((m) => {
    const mes = m.fecha.slice(0, 7);
    if (!meses[mes]) meses[mes] = 0;
    if (m.tipo === "ingreso") meses[mes] += m.monto;
    else meses[mes] -= m.monto;
  });

  const labels = Object.keys(meses).sort();
  if (labels.length === 0) return;

  let saldoAcumulado = 0;
  const datos = labels.map((mes) => {
    saldoAcumulado += meses[mes];
    return saldoAcumulado;
  });

  const ultimoSaldo = datos[datos.length - 1];
  const primerSaldo = datos[0];
  const colorLinea = ultimoSaldo >= primerSaldo ? "#10b981" : "#ef4444";
  const colorRelleno =
    ultimoSaldo >= primerSaldo
      ? "rgba(16, 185, 129, 0.1)"
      : "rgba(239, 68, 68, 0.1)";

  chartInstance = new Chart(ctx, {
    type: "line",
    data: {
      labels: labels.map((mes) => {
        const [year, month] = mes.split("-");
        const meses = [
          "Ene",
          "Feb",
          "Mar",
          "Abr",
          "May",
          "Jun",
          "Jul",
          "Ago",
          "Sep",
          "Oct",
          "Nov",
          "Dic",
        ];
        return `${meses[parseInt(month) - 1]} ${year}`;
      }),
      datasets: [
        {
          label: "Evolución del Saldo",
          data: datos,
          borderColor: colorLinea,
          backgroundColor: colorRelleno,
          borderWidth: 3,
          tension: 0.3,
          fill: true,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        y: {
          beginAtZero: false,
          grid: { color: "#e2e8f0" },
          ticks: { callback: (v) => "S/ " + v.toFixed(2) },
        },
        x: { grid: { display: false } },
      },
    },
  });
}

// ============================================
// EXPORTAR JSON - MEJORADA
// ============================================
function exportarJSON() {
  if (movimientos.length === 0) {
    alert(
      "⚠️ No hay datos para exportar.\n\nAgrega al menos un movimiento primero.",
    );
    return;
  }

  const backup = {
    version: "2.0",
    fecha: new Date().toISOString(),
    totalMovimientos: movimientos.length,
    datos: movimientos.map((m) => ({
      tipo: m.tipo,
      descripcion: m.descripcion,
      monto: m.monto,
      fecha: m.fecha,
    })),
  };

  const blob = new Blob([JSON.stringify(backup, null, 2)], {
    type: "application/json",
  });

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `respaldo_jlbh_${new Date().toISOString().slice(0, 10)}.json`;

  document.body.appendChild(a);
  a.click();

  // Limpiar
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  alert(
    `✅ Archivo exportado correctamente\n\n📊 ${movimientos.length} movimientos guardados`,
  );
}

// ===================================================================================
// IMPORTAR JSON - CORREGIDA
// ============================================
function importarJSON(inputFile) {
  const file = inputFile.files[0];
  if (!file) {
    alert("❌ No se seleccionó ningún archivo");
    return;
  }

  // Verificar que sea un archivo JSON
  if (!file.name.endsWith(".json")) {
    alert("❌ El archivo debe tener extensión .json");
    return;
  }

  const reader = new FileReader();

  reader.onload = async function (e) {
    try {
      const texto = e.target.result;

      // Verificar si el archivo está vacío
      if (!texto || texto.trim().length === 0) {
        throw new Error("El archivo JSON está vacío");
      }

      let datos = JSON.parse(texto);

      // Determinar si es el formato correcto
      let datosRaw;
      if (Array.isArray(datos)) {
        // Formato antiguo (array directo)
        datosRaw = datos;
      } else if (datos.datos && Array.isArray(datos.datos)) {
        // Formato nuevo (con metadatos)
        datosRaw = datos.datos;
      } else {
        throw new Error(
          "Formato de JSON inválido. Debe ser un array o tener una propiedad 'datos'",
        );
      }

      if (datosRaw.length === 0) {
        throw new Error("El archivo no contiene movimientos");
      }

      // Confirmar importación
      const confirmacion = confirm(
        `📋 Se encontraron ${datosRaw.length} movimientos.\n\n` +
          `⚠️ Esto eliminará todos los datos actuales y los reemplazará.\n\n` +
          `¿Deseas continuar?`,
      );

      if (!confirmacion) return;

      alert("⏳ Iniciando restauración... Por favor espera.");

      try {
        // 1. Eliminar todos los movimientos actuales
        const snapshot = await db.collection("movimientos").get();

        if (!snapshot.empty) {
          const batch = db.batch();
          snapshot.forEach((doc) => batch.delete(doc.ref));
          await batch.commit();
          console.log(`✅ Eliminados ${snapshot.size} movimientos antiguos`);
        }

        // 2. Agregar los nuevos movimientos
        const nuevoBatch = db.batch();
        let count = 0;

        datosRaw.forEach((mov) => {
          // Validar que el movimiento tenga los campos requeridos
          if (mov.tipo && mov.descripcion && mov.monto && mov.fecha) {
            const docRef = db.collection("movimientos").doc();
            nuevoBatch.set(docRef, {
              tipo: mov.tipo,
              descripcion: mov.descripcion,
              monto: parseFloat(mov.monto),
              fecha: mov.fecha,
            });
            count++;
          }
        });

        await nuevoBatch.commit();

        alert(
          `✅ ¡Restauración completada!\n\n` +
            `📊 ${count} movimientos sincronizados.\n` +
            `🔄 La página se recargará en 2 segundos...`,
        );

        setTimeout(() => {
          location.reload();
        }, 2000);
      } catch (error) {
        console.error("❌ Error en Firebase:", error);
        alert(
          "⚠️ Error al guardar en Firebase:\n" +
            error.message +
            "\n\nVerifica:\n" +
            "1. Que estés conectado a internet\n" +
            "2. Que Firebase esté inicializado\n" +
            "3. Las reglas de seguridad de Firestore",
        );
      }
    } catch (err) {
      console.error("❌ Error al procesar JSON:", err);
      alert(`❌ Error:\n\n${err.message}`);
    }

    // Limpiar el input
    inputFile.value = "";
  };

  reader.onerror = function () {
    alert("❌ Error al leer el archivo");
    inputFile.value = "";
  };

  // Leer el archivo como texto
  reader.readAsText(file);
}

// ============================================
// GENERAR PDF RESUMEN - DISEÑO "PROFIT & LOSS"
// ============================================
async function generarPDFResumen() {
  console.log("📄 Generando reporte estilo 'Profit & Loss'...");

  if (movimientos.length === 0) {
    alert("❌ No hay datos para generar el PDF");
    return;
  }

  if (typeof window.jspdf === "undefined") {
    alert("⚠️ Error: jsPDF no cargó.");
    return;
  }

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();

  // --- AGREGAR ESTO PARA CORREGIR EL ERROR ---
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  // -------------------------------------------

  const margin = 15;
  const contentWidth = pageWidth - margin * 2;

  // --- COLORES CORPORATIVOS (Basados en la imagen) ---
  const colorHeader = [34, 86, 34]; // Verde oscuro (#225622)
  const colorTextDark = [50, 50, 50];
  const colorTextLight = [100, 100, 100];
  const colorTotalBg = [240, 248, 240]; // Verde muy suave para totales

  // --- 1. ENCABEZADO ---
  doc.setFillColor(...colorHeader);
  doc.rect(0, 0, pageWidth, 25, "F");

  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text("JLBH GESTOR FINANCIERO", margin, 10);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  const fechaEmision = new Date().toLocaleDateString("es-ES", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  doc.text(`Fecha de emisión: ${fechaEmision}`, margin, 16);
  doc.text(`Usuario: BAUTISTA HUAYTA JORGE LUIS`, pageWidth - margin, 16, {
    align: "right",
  });

  // Título del Reporte
  doc.setTextColor(...colorHeader);
  doc.setFontSize(16);
  doc.text("Estado de Resultados", margin, 35);
  doc.setFontSize(10);
  doc.setTextColor(...colorTextLight);
  doc.text("(Estado de Resultados)", margin, 40);

  let yPos = 50;

  // --- CÁLCULOS PREVIOS ---
  const totalIngresos = movimientos
    .filter((m) => m.tipo === "ingreso")
    .reduce((acc, m) => acc + m.monto, 0);
  const totalGastos = movimientos
    .filter((m) => m.tipo === "gasto")
    .reduce((acc, m) => acc + m.monto, 0);
  const utilidadNeta = totalIngresos - totalGastos;

  // Agrupar por categorías para el detalle
  const categorias = agruparPorPalabrasClave(
    movimientos.filter((m) => m.tipo === "gasto"),
  );
  const labelsGastos = Object.keys(categorias).filter(
    (cat) => categorias[cat] > 0,
  );

  // Agrupar ingresos (simulado como "Ventas" y "Servicios")
  const ingresosMovimientos = movimientos.filter((m) => m.tipo === "ingreso");
  const totalIngresosPrincipales = ingresosMovimientos.reduce(
    (acc, m) => acc + m.monto,
    0,
  );

  // --- 2. SECCIÓN DE INGRESOS (REVENUE) ---
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...colorTextDark);
  doc.text("INGRESOS TOTALES", margin, yPos);
  yPos += 8;

  // Fila: Ingresos Totales
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text("Total ganancias y gastos", margin, yPos);
  doc.text(`S/ ${totalIngresos.toFixed(2)}`, pageWidth - margin, yPos, {
    align: "right",
  });

  // Línea separadora fina
  doc.setDrawColor(220, 220, 220);
  doc.line(margin, yPos + 2, pageWidth - margin, yPos + 2);

  yPos += 10;

  // --- 3. SECCIÓN DE GASTOS (EXPENSES) ---
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text("Gastos", margin, yPos);
  yPos += 8;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);

  // Listar gastos por categoría (Detalle)
  labelsGastos.forEach((cat) => {
    const monto = categorias[cat];
    // Nombre de la categoría (Capitalizado)
    const nombreCat = cat.charAt(0).toUpperCase() + cat.slice(1);

    doc.text(nombreCat, margin, yPos);
    doc.text(`S/ ${monto.toFixed(2)}`, pageWidth - margin, yPos, {
      align: "right",
    });

    yPos += 6; // Espacio entre filas (CORREGIDO: antes estaba muy pegado)

    // Salto de página si es necesario
    if (yPos > 270) {
      doc.addPage();
      yPos = 20;
    }
  });

  // Línea separadora antes del total de gastos
  doc.setDrawColor(220, 220, 220);
  doc.line(margin, yPos, pageWidth - margin, yPos);
  yPos += 2;

  // Fila: Total Expenses
  doc.setFont("helvetica", "bold");
  doc.text("Total Gastos", margin, yPos);
  doc.text(`S/ ${totalGastos.toFixed(2)}`, pageWidth - margin, yPos, {
    align: "right",
  });

  yPos += 10;

  // --- 4. RESULTADO FINAL (NET PROFIT) ---
  // Fondo suave para resaltar el resultado
  doc.setFillColor(...colorTotalBg);
  doc.roundedRect(margin, yPos - 5, contentWidth, 12, 2, 2, "F");

  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");

  // Color del texto según si hay ganancia o pérdida
  if (utilidadNeta >= 0) {
    doc.setTextColor(34, 86, 34); // Verde
  } else {
    doc.setTextColor(185, 28, 28); // Rojo
  }

  doc.text("Beneficio neto (pérdida)", margin, yPos + 2);
  doc.text(`S/ ${utilidadNeta.toFixed(2)}`, pageWidth - margin, yPos + 2, {
    align: "right",
  });

  // --- 5. PIE DE PÁGINA ---
  const pageCount = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text(
      "Generado automáticamente por JLBH Gestor Financiero",
      pageWidth / 2,
      pageHeight - 10,
      { align: "center" },
    );
  }

  // Guardar
  doc.save(
    `Estado-Resultados-JLBH-${new Date().toISOString().split("T")[0]}.pdf`,
  );
  console.log("✅ PDF generado exitosamente");
}

// ============================================
// TOGGLE SECCIONES - ÚNICO (SIN DUPLICAR)
// ============================================
function configurarToggles() {
  // Toggle Historial
  const btnHistorial = document.getElementById("toggleHistorial");
  if (btnHistorial) {
    btnHistorial.addEventListener("click", () => {
      const lista = document.getElementById("listaMovimientos");
      const buscador = document.getElementById("buscador-container");

      if (lista) {
        const estaOculto = lista.style.display === "none";
        lista.style.display = estaOculto ? "block" : "none";

        if (buscador) {
          buscador.style.display = estaOculto ? "block" : "none";
        }

        btnHistorial.innerHTML = estaOculto
          ? '<i class="fas fa-eye-slash"></i> Ocultar'
          : '<i class="fas fa-eye"></i> Mostrar';
      }
    });
  }

  // Toggle Reporte Mensual
  const btnReporte = document.getElementById("toggleReporte");
  if (btnReporte) {
    btnReporte.addEventListener("click", () => {
      const reporte = document.getElementById("reporteMensual");

      if (reporte) {
        const estaOculto = reporte.style.display === "none";
        reporte.style.display = estaOculto ? "block" : "none";

        btnReporte.innerHTML = estaOculto
          ? '<i class="fas fa-eye-slash"></i> Ocultar'
          : '<i class="fas fa-eye"></i> Mostrar';
      }
    });
  }

  // Toggle Gráfico de Saldo
  const btnGrafico = document.getElementById("toggleGraficoSaldo");
  if (btnGrafico) {
    btnGrafico.addEventListener("click", () => {
      const container = document.getElementById("graficoSaldoContainer");

      if (container) {
        const estaOculto = container.style.display === "none";
        container.style.display = estaOculto ? "block" : "none";

        btnGrafico.innerHTML = estaOculto
          ? '<i class="fas fa-eye-slash"></i> Ocultar'
          : '<i class="fas fa-eye"></i> Mostrar';
      }
    });
  }
}

// ============================================
// INICIALIZACIÓN - ÚNICO (SIN DUPLICAR)
// ============================================
window.addEventListener("DOMContentLoaded", () => {
  // Fecha actual por defecto
  if (dom.fecha) dom.fecha.valueAsDate = new Date();

  // Conectar a Firebase
  conectarYEscucharBaseDeDatos();

  // Configurar toggles
  configurarToggles();

  console.log("✅ Sistema inicializado correctamente");
});

// ============================================
// HACER FUNCIONES GLOBALES PARA HTML
// ============================================
window.exportarJSON = exportarJSON;
window.importarJSON = importarJSON;
window.generarPDFResumen = generarPDFResumen;

// --- PRUEBA DE DIAGNÓSTICO ---
console.log("🔍 Iniciando diagnóstico...");
console.log(
  "1. ¿Existe db?",
  typeof db !== "undefined" ? "✅ SÍ" : "❌ NO (Revisa Firebase en HTML)",
);
console.log(
  "2. ¿Existe Chart?",
  typeof Chart !== "undefined" ? "✅ SÍ" : "❌ NO (Revisa librería Chart.js)",
);
console.log(
  "3. ¿Existe jsPDF?",
  typeof window.jspdf !== "undefined"
    ? "✅ SÍ"
    : "❌ NO (Revisa librería jsPDF)",
);
console.log(
  "4. ¿Existe lista?",
  document.getElementById("listaMovimientos")
    ? "✅ SÍ"
    : "❌ NO (Revisa ID en HTML)",
);
console.log("-----------------------");

// ============================================
// ORDENAMIENTO DE LISTAS
// ============================================
let ordenIngresos = "desc"; // 'desc' o 'asc'
let ordenGastos = "desc";

function ordenarIngresos() {
  ordenIngresos = ordenIngresos === "desc" ? "asc" : "desc";
  const btn = document.getElementById("btnOrdenarIngresos");
  btn.textContent =
    ordenIngresos === "desc" ? "⬇️ Mayor a Menor" : "⬆️ Menor a Mayor";
  generarResumenComparativo();
}

function ordenarGastos() {
  ordenGastos = ordenGastos === "desc" ? "asc" : "desc";
  const btn = document.getElementById("btnOrdenarGastos");
  btn.textContent =
    ordenGastos === "desc" ? "⬇️ Mayor a Menor" : "⬆️ Menor a Mayor";
  generarResumenComparativo();
}

// Modificar la función generarResumenComparativo existente
function generarResumenComparativo() {
  const container = document.getElementById("listaIngresosHistorico");
  const containerGastos = document.getElementById("listaGastosHistorico");
  const totalIngEl = document.getElementById("totalIngresosHistorico");
  const totalGasEl = document.getElementById("totalGastosHistorico");

  if (!container || !containerGastos) return;

  container.innerHTML = "";
  containerGastos.innerHTML = "";

  let ingresos = movimientos.filter((m) => m.tipo === "ingreso");
  let gastos = movimientos.filter((m) => m.tipo === "gasto");

  // Ordenar ingresos
  ingresos.sort((a, b) => {
    return ordenIngresos === "desc" ? b.monto - a.monto : a.monto - b.monto;
  });

  // Ordenar gastos
  gastos.sort((a, b) => {
    return ordenGastos === "desc" ? b.monto - a.monto : a.monto - b.monto;
  });

  const totalIngresos = ingresos.reduce((acc, m) => acc + m.monto, 0);
  const totalGastos = gastos.reduce((acc, m) => acc + m.monto, 0);

  if (totalIngEl) totalIngEl.textContent = `S/ ${totalIngresos.toFixed(2)}`;
  if (totalGasEl) totalGasEl.textContent = `S/ ${totalGastos.toFixed(2)}`;

  ingresos.forEach((m) => {
    const div = document.createElement("div");
    div.className = "item-movimiento";
    div.innerHTML = `<div> <div class="item-desc">${m.descripcion}</div> <div class="item-fecha">${m.fecha}</div> </div> <div class="item-monto">+ S/ ${m.monto.toFixed(2)}</div>`;
    container.appendChild(div);
  });

  gastos.forEach((m) => {
    const div = document.createElement("div");
    div.className = "item-movimiento";
    div.innerHTML = `<div> <div class="item-desc">${m.descripcion}</div> <div class="item-fecha">${m.fecha}</div> </div> <div class="item-monto">- S/ ${m.monto.toFixed(2)}</div>`;
    containerGastos.appendChild(div);
  });
}

// ============================================
// CHATBOT ASISTENTE VIRTUAL
// ============================================
function toggleChatbot() {
  const chatbot = document.getElementById("chatbot-container");
  if (chatbot.style.display === "none" || !chatbot.style.display) {
    chatbot.style.display = "flex";
    if (document.getElementById("chatbot-mensajes").children.length === 0) {
      agregarMensajeChatbot(
  "bot",
  "¡Hola! 👋 Soy tu asistente con IA (Gemini + RAG). Ya conozco todos tus movimientos financieros. Pregúntame:\n• ¿En qué gasté más este mes?\n• ¿Cómo puedo ahorrar más?\n• Analiza mis hábitos de gasto\n• ¿Cuánto gasto en comida vs pasajes?\n• Dame recomendaciones personalizadas"
);
    }
  } else {
    chatbot.style.display = "none";
  }
}

function agregarMensajeChatbot(tipo, mensaje) {
  const container = document.getElementById("chatbot-mensajes");
  const div = document.createElement("div");
  div.style.cssText = `margin:10px 0; padding:10px; border-radius:10px; max-width:80%; ${tipo === "user" ? "margin-left:auto; background:#667eea; color:white;" : "background:#f1f5f9;"}`;
  div.textContent = mensaje;
  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
}

// ============================================
// CHATBOT CON RAG - ENVIAR MENSAJE (ASYNC)
// ============================================
async function enviarMensajeChatbot() {
  const input = document.getElementById("chatbot-input");
  const mensaje = input.value.trim();
  if (!mensaje) return;

  agregarMensajeChatbot("user", mensaje);
  input.value = "";

  // Indicador "escribiendo..."
  const idTyping = "typing-" + Date.now();
  const container = document.getElementById("chatbot-mensajes");
  const typingDiv = document.createElement("div");
  typingDiv.id = idTyping;
  typingDiv.style.cssText =
    "margin:10px 0; padding:10px; border-radius:10px; background:#f1f5f9; color:#64748b; font-style:italic;";
  typingDiv.textContent = "🤖 Analizando tus finanzas con IA...";
  container.appendChild(typingDiv);
  container.scrollTop = container.scrollHeight;

  try {
    const respuesta = await consultarGeminiRAG(mensaje.toLowerCase());
    const typing = document.getElementById(idTyping);
    if (typing) typing.remove();
    agregarMensajeChatbot("bot", respuesta);
  } catch (error) {
    const typing = document.getElementById(idTyping);
    if (typing) typing.remove();
    agregarMensajeChatbot(
      "bot",
      "⚠️ Tuve un problema al analizar. Intenta de nuevo en unos segundos."
    );
  }
}

function procesarPreguntaChatbotLocal(pregunta) {
  // Análisis de preguntas comunes
  if (
    pregunta.includes("mejor mes") ||
    pregunta.includes("mayor ingreso") ||
    pregunta.includes("mes gané más")
  ) {
    return obtenerMejorMes();
  }

  if (
    pregunta.includes("peor mes") ||
    pregunta.includes("menor ingreso") ||
    pregunta.includes("mes gané menos")
  ) {
    return obtenerPeorMes();
  }

  if (
    pregunta.includes("gasto más") ||
    pregunta.includes("mayor gasto") ||
    pregunta.includes("mes gasté más")
  ) {
    return obtenerMesMasGasto();
  }

  if (
    pregunta.includes("balance") ||
    pregunta.includes("saldo") ||
    pregunta.includes("cuánto tengo")
  ) {
    return obtenerBalanceActual();
  }

  if (pregunta.includes("total gasto") || pregunta.includes("gastos totales")) {
    return obtenerTotalGastos();
  }

  if (
    pregunta.includes("total ingreso") ||
    pregunta.includes("ingresos totales")
  ) {
    return obtenerTotalIngresos();
  }

  if (
    pregunta.includes("top 3 gasto") ||
    pregunta.includes("mayores gastos") ||
    pregunta.includes("gasté más en")
  ) {
    return obtenerTopGastos();
  }

  if (pregunta.includes("categoría") || pregunta.includes("categoria")) {
    return obtenerResumenCategorias();
  }

  if (
    pregunta.includes("promedio") ||
    pregunta.includes("diario") ||
    pregunta.includes("gasto promedio")
  ) {
    return obtenerPromedioDiario();
  }

  if (pregunta.includes("hola") || pregunta.includes("buenas")) {
    return "¡Hola! ¿En qué puedo ayudarte con tus finanzas hoy?";
  }

  if (pregunta.includes("ayuda") || pregunta.includes("qué puedes hacer")) {
    return "Puedo ayudarte con:\n• Mejor/peor mes de ingresos\n• Mes con más gastos\n• Balance actual\n• Totales de ingresos/gastos\n• Top 3 gastos\n• Resumen por categorías\n• Promedio diario";
  }

  return 'No entendí tu pregunta. Prueba con:\n• "¿Cuál fue mi mejor mes?"\n• "¿Mis gastos totales?"\n• "¿Balance actual?"\n• "Top 3 gastos"';
}

function obtenerMejorMes() {
  const ingresosPorMes = {};

  movimientos
    .filter((m) => m.tipo === "ingreso")
    .forEach((m) => {
      const mes = m.fecha.substring(0, 7);
      ingresosPorMes[mes] = (ingresosPorMes[mes] || 0) + m.monto;
    });

  const mejorMes = Object.entries(ingresosPorMes).sort(
    (a, b) => b[1] - a[1],
  )[0];

  if (!mejorMes) return "No hay ingresos registrados.";

  const [año, mes] = mejorMes[0].split("-");
  const nombreMes = new Date(parseInt(año), parseInt(mes) - 1).toLocaleString(
    "es-ES",
    { month: "long", year: "numeric" },
  );

  return `📈 Tu mejor mes fue ${nombreMes.toUpperCase()} con S/ ${mejorMes[1].toFixed(2)} en ingresos.`;
}

function obtenerPeorMes() {
  const ingresosPorMes = {};

  movimientos
    .filter((m) => m.tipo === "ingreso")
    .forEach((m) => {
      const mes = m.fecha.substring(0, 7);
      ingresosPorMes[mes] = (ingresosPorMes[mes] || 0) + m.monto;
    });

  const peorMes = Object.entries(ingresosPorMes).sort((a, b) => a[1] - b[1])[0];

  if (!peorMes) return "No hay ingresos registrados.";

  const [año, mes] = peorMes[0].split("-");
  const nombreMes = new Date(parseInt(año), parseInt(mes) - 1).toLocaleString(
    "es-ES",
    { month: "long", year: "numeric" },
  );

  return `📉 Tu mes con menos ingresos fue ${nombreMes.toUpperCase()} con S/ ${peorMes[1].toFixed(2)}.`;
}

function obtenerMesMasGasto() {
  const gastosPorMes = {};

  movimientos
    .filter((m) => m.tipo === "gasto")
    .forEach((m) => {
      const mes = m.fecha.substring(0, 7);
      gastosPorMes[mes] = (gastosPorMes[mes] || 0) + m.monto;
    });

  const mesGasto = Object.entries(gastosPorMes).sort((a, b) => b[1] - a[1])[0];

  if (!mesGasto) return "No hay gastos registrados.";

  const [año, mes] = mesGasto[0].split("-");
  const nombreMes = new Date(parseInt(año), parseInt(mes) - 1).toLocaleString(
    "es-ES",
    { month: "long", year: "numeric" },
  );

  return `💸 El mes con más gastos fue ${nombreMes.toUpperCase()} con S/ ${mesGasto[1].toFixed(2)}.`;
}

function obtenerBalanceActual() {
  const ingresos = movimientos
    .filter((m) => m.tipo === "ingreso")
    .reduce((acc, m) => acc + m.monto, 0);
  const gastos = movimientos
    .filter((m) => m.tipo === "gasto")
    .reduce((acc, m) => acc + m.monto, 0);
  const balance = ingresos - gastos;

  return `💰 Balance Actual:\n• Ingresos: S/ ${ingresos.toFixed(2)}\n• Gastos: S/ ${gastos.toFixed(2)}\n• Saldo: S/ ${balance.toFixed(2)} ${balance >= 0 ? "✅" : "⚠️"}`;
}

function obtenerTotalGastos() {
  const total = movimientos
    .filter((m) => m.tipo === "gasto")
    .reduce((acc, m) => acc + m.monto, 0);
  const cantidad = movimientos.filter((m) => m.tipo === "gasto").length;
  return `💳 Total de gastos: S/ ${total.toFixed(2)} en ${cantidad} movimientos.`;
}

function obtenerTotalIngresos() {
  const total = movimientos
    .filter((m) => m.tipo === "ingreso")
    .reduce((acc, m) => acc + m.monto, 0);
  const cantidad = movimientos.filter((m) => m.tipo === "ingreso").length;
  return `💵 Total de ingresos: S/ ${total.toFixed(2)} en ${cantidad} movimientos.`;
}

function obtenerTopGastos() {
  const topGastos = [...movimientos]
    .filter((m) => m.tipo === "gasto")
    .sort((a, b) => b.monto - a.monto)
    .slice(0, 3);

  if (topGastos.length === 0) return "No hay gastos registrados.";

  let respuesta = "🔝 Top 3 mayores gastos:\n";
  topGastos.forEach((gasto, i) => {
    respuesta += `${i + 1}. ${gasto.descripcion} - S/ ${gasto.monto.toFixed(2)} (${gasto.fecha})\n`;
  });

  return respuesta;
}

function obtenerResumenCategorias() {
  const categorias = agruparPorPalabrasClave(
    movimientos.filter((m) => m.tipo === "gasto"),
  );
  const total = Object.values(categorias).reduce((a, b) => a + b, 0);

  let respuesta = "📊 Resumen por categorías:\n";
  Object.entries(categorias)
    .filter(([_, monto]) => monto > 0)
    .sort((a, b) => b[1] - a[1])
    .forEach(([cat, monto]) => {
      const porcentaje = total > 0 ? ((monto / total) * 100).toFixed(1) : 0;
      respuesta += `• ${cat.toUpperCase()}: S/ ${monto.toFixed(2)} (${porcentaje}%)\n`;
    });

  return respuesta;
}

function obtenerPromedioDiario() {
  const gastos = movimientos.filter((m) => m.tipo === "gasto");
  if (gastos.length === 0) return "No hay gastos registrados.";

  const fechas = gastos.map((m) => new Date(m.fecha));
  const fechaMin = new Date(Math.min(...fechas));
  const fechaMax = new Date(Math.max(...fechas));
  const dias = Math.max(
    Math.ceil((fechaMax - fechaMin) / (1000 * 60 * 60 * 24)) + 1,
    1,
  );

  const totalGastos = gastos.reduce((acc, m) => acc + m.monto, 0);
  const promedio = totalGastos / dias;

  return `📅 Promedio diario de gastos: S/ ${promedio.toFixed(2)}\n• Período: ${dias} días\n• Total: S/ ${totalGastos.toFixed(2)}`;
}

// Permitir enviar con Enter
document.addEventListener("DOMContentLoaded", () => {
  const chatInput = document.getElementById("chatbot-input");
  if (chatInput) {
    chatInput.addEventListener("keypress", (e) => {
      if (e.key === "Enter") enviarMensajeChatbot();
    });
  }
});

// ============================================
// RAG: CONSTRUIR CONTEXTO CON TUS DATOS
// ============================================
function construirContextoRAG() {
  if (movimientos.length === 0) {
    return "El usuario no tiene movimientos financieros registrados todavía.";
  }

  const ingresos = movimientos.filter((m) => m.tipo === "ingreso");
  const gastos = movimientos.filter((m) => m.tipo === "gasto");
  const totalIngresos = ingresos.reduce((a, m) => a + m.monto, 0);
  const totalGastos = gastos.reduce((a, m) => a + m.monto, 0);
  const saldo = totalIngresos - totalGastos;

  // Categorías (usa tu función existente)
  const categorias = agruparPorPalabrasClave(gastos);
  const resumenCategorias = Object.entries(categorias)
    .filter(([_, monto]) => monto > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([cat, monto]) => `  - ${cat}: S/ ${monto.toFixed(2)}`)
    .join("\n");

  // Resumen mensual
  const meses = {};
  movimientos.forEach((m) => {
    const mes = m.fecha.substring(0, 7);
    if (!meses[mes]) meses[mes] = { ingresos: 0, gastos: 0 };
    if (m.tipo === "ingreso") meses[mes].ingresos += m.monto;
    else meses[mes].gastos += m.monto;
  });
  const resumenMensual = Object.entries(meses)
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([mes, d]) => {
      const neto = d.ingresos - d.gastos;
      return `  - ${mes}: Ingresos S/ ${d.ingresos.toFixed(2)}, Gastos S/ ${d.gastos.toFixed(2)}, Neto S/ ${neto.toFixed(2)}`;
    })
    .join("\n");

  // Últimos 15 movimientos
  const recientes = [...movimientos]
    .sort((a, b) => new Date(b.fecha) - new Date(a.fecha))
    .slice(0, 15)
    .map((m) => `  - ${m.fecha} | ${m.tipo} | ${m.descripcion} | S/ ${m.monto.toFixed(2)}`)
    .join("\n");

  // Top 5 mayores gastos
  const topGastos = [...gastos]
    .sort((a, b) => b.monto - a.monto)
    .slice(0, 5)
    .map((g, i) => `  ${i + 1}. ${g.descripcion}: S/ ${g.monto.toFixed(2)} (${g.fecha})`)
    .join("\n");

  return `DATOS FINANCIEROS DEL USUARIO (JLBH Gestor Financiero):

📊 RESUMEN GENERAL:
- Total Ingresos: S/ ${totalIngresos.toFixed(2)}
- Total Gastos: S/ ${totalGastos.toFixed(2)}
- Saldo Actual: S/ ${saldo.toFixed(2)}
- Total de movimientos: ${movimientos.length}
- Meta de ahorro: Lente Todoterreno 18-300mm (S/ 2500)

📂 GASTOS POR CATEGORÍA:
${resumenCategorias}

📅 RESUMEN MENSUAL:
${resumenMensual}

🕐 ÚLTIMOS 15 MOVIMIENTOS:
${recientes}

🔝 TOP 5 MAYORES GASTOS:
${topGastos}`;
}

// ============================================
// RAG: CONSULTAR A GEMINI
// ============================================
async function consultarGeminiRAG(pregunta) {
  try {
    const contexto = construirContextoRAG();

    const prompt = `Eres un asistente financiero personal experto. Analiza los siguientes datos financieros del usuario y responde su pregunta de forma clara y útil.

${contexto}

INSTRUCCIONES:
- Responde SOLO basándote en los datos proporcionados. No inventes cifras.
- Sé conciso (máximo 5-6 líneas). Usa viñetas si ayuda.
- Moneda: Soles peruanos (S/).
- Si detectas patrones interesantes, menciónalos brevemente.
- Si la pregunta no se puede responder con estos datos, dilo honestamente.
- Responde siempre en español.

PREGUNTA DEL USUARIO: ${pregunta}

RESPUESTA:`;

    const response = await fetch(GEMINI_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.4,
          maxOutputTokens: 500,
        },
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error?.message || "Error HTTP " + response.status);
    }

    const data = await response.json();
    const respuesta = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!respuesta) throw new Error("Respuesta vacía de Gemini");
    return respuesta.trim();
  } catch (error) {
    console.error("❌ Error en Gemini RAG:", error);
    // Fallback: usa tu sistema antiguo de reglas
    return procesarPreguntaChatbotLocal(pregunta);
  }
}