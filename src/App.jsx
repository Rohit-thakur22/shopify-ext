import './App.css'
import ProductCustomizer from './components/ProductCustomizer'

function App() {
  // In the full app, variantId would come from Shopify Liquid template
  // For development, we use a placeholder or get from container dataset
  const container = document.getElementById('cloth-editor-app');
  const variantId = container?.dataset?.variantId || null;

  return (
    <ProductCustomizer variantId={variantId} />
  )
}

export default App
