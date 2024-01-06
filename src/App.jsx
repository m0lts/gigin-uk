import { Routes, Route } from 'react-router-dom'
import { Home } from './pages/Home/Home'
import { Login } from '/pages/Login/Login'
import { Signup } from '/pages/Signup/Signup'
import { HostWithGigin } from './pages/HostWithGigin/HostWithGigin'
import { Help } from '/pages/Help/Help'
import { ContactUs } from './pages/ContactUs/ContactUs'
import '../src/assets/global.styles.css'
import { ForgotPassword } from '/pages/ForgotPassword/ForgotPassword'
import { ControlCentreIndex } from './pages/ControlCentre/ControlCentreIndex'
import { ProfileCreator } from './pages/ProfileCreator/ProfileCreator'
import { ControlCentre } from './pages/ControlCentre/Outlets/ControlCentre'

export default function App() {

  return (
      <Routes>
        <Route path='/' element={<Home />} />
        <Route path='/help' element={<Help />} />
        <Route path='/contact-us' element={<ContactUs />} />
        <Route path='/hosting' element={<HostWithGigin />} />
        <Route path='/login' element={<Login />} />
        <Route path='/signup' element={<Signup />} />
        <Route path='/forgotpassword' element={<ForgotPassword />} />
        <Route path='control-centre' element={<ControlCentreIndex />}>
          <Route index element={<ControlCentre />}/>
        </Route>
        <Route path='/profile-creator' element={<ProfileCreator />} />
      </Routes>
  )
}

