import { Routes, Route } from 'react-router-dom'
import HomePage from './components/Global/homePage/HomePage'
import '../src/assets/global.css'

export default function App() {

  return (
      <Routes>
        <Route path='/' element={<HomePage />} />
      </Routes>
  )
}

