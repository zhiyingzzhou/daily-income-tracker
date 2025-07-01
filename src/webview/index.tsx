import { createRoot } from 'react-dom/client';
import { SettingsApp } from './components/SettingsApp';
import './styles/index.css';

const container = document.getElementById('root');
const root = createRoot(container!);

root.render(<SettingsApp />);
