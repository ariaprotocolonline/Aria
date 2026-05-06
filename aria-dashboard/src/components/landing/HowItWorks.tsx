import { motion } from 'framer-motion';
import { Search, Zap, Activity } from 'lucide-react';

const HowItWorks = () => {
  const container = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.3
      }
    }
  };

  const item = {
    hidden: { opacity: 0, y: 30 },
    show: { opacity: 1, y: 0, transition: { duration: 0.8 } }
  };

  return (
    <section className="py-24 border-t border-soft">
      <div className="max-w-7xl mx-auto px-6 md:px-12 lg:px-24">
        <div className="mb-16 text-center">
          <h3 data-tour="how-it-works" className="font-serif text-3xl font-bold text-text-primary mb-4">How ARIA Works</h3>
          <p className="text-text-secondary max-w-2xl mx-auto">
            A three-step deterministic engine that secures yield before human analysts can even refresh their dashboards.
          </p>
        </div>

        <motion.div 
          variants={container}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: "-100px" }}
          className="grid grid-cols-1 md:grid-cols-3 gap-12"
        >
          {/* Column 1 */}
          <motion.div variants={item} className="flex flex-col items-center md:items-start text-center md:text-left">
            <div className="w-12 h-12 bg-bg-soft border border-soft flex items-center justify-center rounded-sm mb-6 text-accent">
              <Search size={24} />
            </div>
            <h4 className="font-serif text-xl font-bold text-text-primary mb-3">Liquidity Depth Scanning</h4>
            <p className="text-text-secondary leading-relaxed text-sm">
              ARIA detects fake incentive-driven depth versus real organic liquidity, preventing slippage traps in volatile Mantle protocols.
            </p>
          </motion.div>

          {/* Column 2 */}
          <motion.div variants={item} className="flex flex-col items-center md:items-start text-center md:text-left">
            <div className="w-12 h-12 bg-bg-soft border border-soft flex items-center justify-center rounded-sm mb-6 text-accent">
              <Activity size={24} />
            </div>
            <h4 className="font-serif text-xl font-bold text-text-primary mb-3">Yield Opportunity Detection</h4>
            <p className="text-text-secondary leading-relaxed text-sm">
              Continuous scanning across lending markets and DEXes to calculate optimal risk-adjusted returns in real-time.
            </p>
          </motion.div>

          {/* Column 3 */}
          <motion.div variants={item} className="flex flex-col items-center md:items-start text-center md:text-left">
            <div className="w-12 h-12 bg-bg-soft border border-soft flex items-center justify-center rounded-sm mb-6 text-accent">
              <Zap size={24} />
            </div>
            <h4 className="font-serif text-xl font-bold text-text-primary mb-3">Autonomous Reallocation</h4>
            <p className="text-text-secondary leading-relaxed text-sm">
              ARIA executes complex cross-protocol swaps and deposits instantly, without waiting for human confirmation.
            </p>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
};

export default HowItWorks;
