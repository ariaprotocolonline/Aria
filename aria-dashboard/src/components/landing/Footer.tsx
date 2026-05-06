import { Link } from 'react-router-dom';

const Footer = () => {
  return (
    <footer className="bg-bg py-12 border-t border-soft">
      <div className="max-w-7xl mx-auto px-6 md:px-12 lg:px-24">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-8 mb-12">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <h1 className="font-serif text-3xl font-bold tracking-tight text-text-primary">ARIA</h1>
            </div>
            <p className="text-text-secondary text-sm">Autonomous RWA Intelligence Agent</p>
          </div>
          
          <div className="flex gap-8 text-sm font-medium">
            <Link to="/docs" className="text-text-secondary hover:text-text-primary transition-colors">Docs</Link>
            <a href="#" className="text-text-secondary hover:text-text-primary transition-colors">GitHub</a>
            <a href="#" className="text-text-secondary hover:text-text-primary transition-colors">Twitter</a>
            <a href="#" className="text-text-secondary hover:text-text-primary transition-colors">Mantle Explorer</a>
          </div>
        </div>
        
        <div className="flex flex-col md:flex-row justify-between items-center pt-8 border-t border-soft gap-4">
          <p className="text-accent text-sm font-semibold tracking-wide uppercase">
            Built on Mantle
          </p>
          <p className="font-serif text-text-secondary italic text-sm text-center md:text-right">
            ARIA is autonomous. Your capital shouldn't wait for you.
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
