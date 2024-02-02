// Dependencies
  import { Routes, Route } from 'react-router-dom'

// General Pages
  import { Login } from '/pages/General/Login/Login'
  import { Signup } from '/pages/General/Signup/Signup'
  import { ForgotPassword } from '/pages/General/ForgotPassword/ForgotPassword'
  import { Help } from '/pages/General/Help/Help'
  import { ContactUs } from './pages/General/ContactUs/ContactUs'


// Musician Pages
  import { Home } from './pages/Musician/Home/Home'
  import { GigInformation } from './pages/Musician/GigInformation/GigInformation'


// Host Pages
  import { HostWithGigin } from './pages/Host/HostWithGigin/HostWithGigin'
  import { GigBuilder } from './pages/Host/GigBuilder/GigBuilder'
  import { VenueCreator } from './pages/Host/VenueCreator/VenueCreator'
  import { ControlCentre } from './pages/ControlCentre/ControlCentre'

// Global Styles
import '../src/assets/global.styles.css'
import { HostIndex } from './pages/Host/Index'
import { MusicianIndex } from './pages/Musician/Index'



export default function App() {
  return (
      <Routes>
        {/* Musician Routes */}
        <Route path='/' element={<MusicianIndex />} >
          <Route index element={<Home />} />
          <Route path=':id' element={<GigInformation />} />

        </Route>

        {/* Host Routes */}
        <Route path='/host' element={<HostIndex />} >
          <Route index element={<HostWithGigin />} />
          <Route path='venue-creator' element={<VenueCreator />} />
          <Route path='gig-builder' element={<GigBuilder />} />
        </Route>

        {/* General Routes */}
        <Route path='/help' element={<Help />} />
        <Route path='/contact-us' element={<ContactUs />} />
        <Route path='/login' element={<Login />} />
        <Route path='/signup' element={<Signup />} />
        <Route path='/forgotpassword' element={<ForgotPassword />} />


        <Route path='/control-centre' element={<ControlCentre />} />
      </Routes>
  )
}

