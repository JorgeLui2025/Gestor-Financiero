# 🤖 Cómo funciona el RAG con Gemini en JLBH Gestor Financiero

## ¿Qué es RAG (Retrieval-Augmented Generation)?

Es la técnica que conecta **tus datos** con la **IA**. En lugar de que Gemini
"adivine", nosotros le pasamos un resumen calculado de tus movimientos y le
pedimos que responda **solo** con esa información. El flujo es:

```
Firebase (movimientos)
      │  onSnapshot → array `movimientos` siempre actualizado
      ▼
construirContextoRAG()        ← "Retrieve": convierte TUS datos en un contexto
      │                          (totales, categorías, resumen mensual,
      │                           últimos 15 movimientos, top 5 gastos)
      ▼
consultarGeminiRAG(pregunta)  ← "Generate": arma el prompt + memoria de
      │                          conversación y llama a la API de Gemini
      ▼
Respuesta inteligente en el chatbot (con cálculos, comparaciones, consejos)
```

Si Gemini falla o no hay API key, entra el **fallback local**
(`procesarPreguntaChatbotLocal`) que responde con reglas preprogramadas.

## ✅ Pasos para activarlo

1. Consigue tu API key gratis en <https://aistudio.google.com/apikey>
2. Abre tu gestor en el navegador, presiona **F12** (consola) y ejecuta una sola vez:
   ```js
   localStorage.setItem("GEMINI_API_KEY", "PEGA_AQUI_TU_KEY")
   ```
3. Recarga la página. Listo: el chatbot 💬 ahora responde con IA real.

La key queda guardada solo en **tu** navegador (uso personal), nunca en el código.

## ⚠️ Seguridad importante

- Las keys que estaban hardcodeadas en `index.html` y `javascript-final.js`
  fueron eliminadas. **Revócalas** en Google AI Studio / Google Cloud Console,
  porque al haber estado en el código (y posiblemente en el historial de Git)
  ya son públicas.
- La Firebase `apiKey` del cliente NO es un secreto (así funciona Firebase);
  lo que protege tus datos son las **reglas de seguridad de Firestore**.

## 💡 Cómo mejorar el RAG a futuro

- **Más contexto**: si tus movimientos crecen mucho, en vez de mandar los
  últimos 15, manda solo los relevantes a la pregunta (ej. filtrar por mes
  o categoría según palabras clave de la pregunta).
- **Embeddings vectoriales** (RAG "de verdad"): usar la API
  `embedContent` de Gemini para vectorizar descripciones de gastos y buscar
  por similitud. Con cientos de movimientos vale la pena; con decenas, el
  resumen actual es suficiente y más barato.
- **Tool calling**: pedirle a Gemini que devuelva JSON con instrucciones
  ("agrega un gasto de S/ 20 en comida hoy") y ejecutarlo en tu app.
- **Proxy propio** (Cloud Function): si algún día lo compartes, mueve la key
  a un backend para que nadie la vea.
