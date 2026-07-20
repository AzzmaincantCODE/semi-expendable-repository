import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { initPrintLayoutListeners } from './lib/printDocument'
import { initDevtoolsDeterrent } from './lib/devtoolsDeterrent'

initPrintLayoutListeners()
initDevtoolsDeterrent()

createRoot(document.getElementById("root")!).render(<App />);
