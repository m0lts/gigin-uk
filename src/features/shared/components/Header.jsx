import { LaunchHeader } from './LaunchHeader';

export const Header = ({ setAuthModal, setAuthType, setAuthClosable }) => (
  <LaunchHeader
    setAuthModal={setAuthModal}
    setAuthType={setAuthType}
    setAuthClosable={setAuthClosable}
  />
);
