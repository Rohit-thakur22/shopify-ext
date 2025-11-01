import { useState, useEffect } from 'react'
import './App.css'
import DesignViewer from './components/DesignViewer'
import DesignPlacementSlider from './components/DesignPlacementSlider'

function App() {
  const [imageUrl, setImageUrl] = useState(null);

  useEffect(() => {
    console.log("App: imageUrl state changed to:", imageUrl);
  }, [imageUrl]);

  const handleImageUpload = (url) => {
    console.log("App: handleImageUpload called with:", url);
    setImageUrl(url);
  };

  return (
    <div className='w-full bg-white p-4'>
      <DesignViewer onImageUpload={handleImageUpload} />
      <DesignPlacementSlider 
        tintColor="#6b7280" 
        imageUrl={imageUrl}
      />
    </div>
  )
}

export default App
