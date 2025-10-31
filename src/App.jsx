import './App.css'
import DesignViewer from './components/DesignViewer'
import DesignPlacementSlider from './components/DesignPlacementSlider'

function App() {

  return (
    <div className='w-full bg-white p-4'>
      <DesignViewer />
      <DesignPlacementSlider tintColor="#6b7280" />
    </div>
  )
}

export default App
