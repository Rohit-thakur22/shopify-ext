import { useState, useEffect } from 'react'
import './App.css'
import DesignViewer from './components/DesignViewer'
import DesignPlacementSlider from './components/DesignPlacementSlider'

function App() {
  const [imageUrl, setImageUrl] = useState(null);
  const [tintColor, setTintColor] = useState("#6b7280");

  useEffect(() => {
    console.log("App: imageUrl state changed to:", imageUrl);
  }, [imageUrl]);

  useEffect(() => {
    console.log("App: tintColor state changed to:", tintColor);
  }, [tintColor]);

  const handleImageUpload = (url) => {
    console.log("App: handleImageUpload called with:", url);
    setImageUrl(url);
  };

  const handleColorChange = (color) => {
    console.log("App: handleColorChange called with:", color);
    setTintColor(color);
  };

  return (
    <div className='w-full bg-white p-4'>
      <DesignViewer 
        onImageUpload={handleImageUpload}
        tintColor={tintColor}
        onColorChange={handleColorChange}
      />
      <DesignPlacementSlider 
        tintColor={tintColor} 
        imageUrl={imageUrl}
      />
    </div>
  )
}

export default App
