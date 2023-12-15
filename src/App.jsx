import { Routes, Route } from 'react-router-dom'
import { Index } from './pages/Index/Index'
import { Homepage } from './pages/Global/Home/Homepage'
import { Login } from './pages/Global/Account/Login/Login'
import { Signup } from './pages/Global/Account/Signup/Signup'
import { HostWithGigin } from './pages/Hosts/HostWithGigin/HostWithGigin'
import { Help } from './pages/Global/Help/Help'
import { ContactUs } from './pages/Global/ContactUs/ContactUs'
import { GigGoersHome } from './pages/GigGoers/GigGoersHome/GigGoersHome'
import '../src/assets/global.styles.css'
import { ForgotPassword } from './pages/Global/Account/ForgotPassword/ForgotPassword'
import { ControlCentre } from './pages/Global/ControlCentre/ControlCentre'
import { ProfileCreator } from './components/Global/ControlCentre/Selections/ProfileCreator.jsx/ProfileCreator'

export default function App() {

  return (
      <Routes>
        <Route path='/' element={<Index />}>
          <Route index element={<Homepage />} />
          <Route path='help' element={<Help />} />
          <Route path='contact-us' element={<ContactUs />} />
          <Route path='control-centre' element={<ControlCentre />} />
        </Route>
        <Route path='/login' element={<Login />} />
        <Route path='/signup' element={<Signup />} />
        <Route path='/forgotpassword' element={<ForgotPassword />} />
        <Route path='/host-with-gigin' element={<HostWithGigin />} />
        <Route path='/gig-goers' element={<GigGoersHome />} />
      </Routes>
  )
}

