import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { initPrintLayoutListeners } from './lib/printDocument'

initPrintLayoutListeners()

createRoot(document.getElementById("root")!).render(<App />);
