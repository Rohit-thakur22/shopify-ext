import { useState } from 'react'
import './App.css'
import DesignViewer from './components/DesignViewer'
import DesignPlacementSlider from './components/DesignPlacementSlider'

function App() {
  const [imageUrl, setImageUrl] = useState(null);

  return (
    <div className='w-full bg-white p-4'>
      <DesignViewer onImageUpload={setImageUrl} />
      <DesignPlacementSlider 
        tintColor="#6b7280" 
        imageUrl={imageUrl} 
        onImageUrlChange={setImageUrl}
      />
    </div>
  )
}

export default App
