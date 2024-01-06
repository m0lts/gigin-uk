import { Routes, Route } from 'react-router-dom'
import { Home } from './pages/Home/Home'
import { Login } from '/pages/Login/Login'
import { Signup } from '/pages/Signup/Signup'
import { HostWithGigin } from './pages/HostWithGigin/HostWithGigin'
import { Help } from '/pages/Help/Help'
import { ContactUs } from './pages/ContactUs/ContactUs'
import '../src/assets/global.styles.css'
import { ForgotPassword } from '/pages/ForgotPassword/ForgotPassword'
import { ControlCentreIndex } from './pages/Global/ControlCentre/ControlCentreIndex'
import { ProfileCreator } from './pages/Global/ProfileCreator/ProfileCreator'
import { ControlCentre } from './pages/Global/ControlCentre/Outlets/ControlCentre'

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


        {/* <Route path='/' element={<Index />}>
          <Route index element={<Homepage />} />
          <Route path='help' element={<Help />} />
          <Route path='contact-us' element={<ContactUs />} />
          <Route path='control-centre' element={<ControlCentreIndex />}>
            <Route index element={<ControlCentre />}/>
          </Route>
        </Route> */}
        <Route path='/profile-creator' element={<ProfileCreator />} />
      </Routes>
  )
}

