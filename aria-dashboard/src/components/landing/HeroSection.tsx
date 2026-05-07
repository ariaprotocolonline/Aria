import { motion } from 'framer-motion';
import { useConnectModal } from '@rainbow-me/rainbowkit';

const HeroSection = () => {
  const { openConnectModal } = useConnectModal();

  return (
    <section className="py-16 md:py-24 lg:py-32 flex flex-col items-center justify-center text-center px-6">
      <div className="mb-12 w-full max-w-[280px] mx-auto">
        <motion.svg
          width="100%"
          height="100"
          viewBox="0 0 400 100"
          initial="hidden"
          animate="visible"
          className="mx-auto"
        >
          <motion.text
            x="50%"
            y="50%"
            dominantBaseline="middle"
            textAnchor="middle"
            fill="transparent"
            stroke="var(--text-primary)"
            strokeWidth="2"
            className="font-serif text-[80px] font-bold tracking-widest"
            variants={{
              hidden: { strokeDasharray: "0 1000", opacity: 0 },
              visible: {
                strokeDasharray: "1000 1000",
                opacity: 1,
                transition: { duration: 3, ease: "easeInOut" }
              }
            }}
          >
            ARIA
          </motion.text>
        </motion.svg>
      </div>

      <motion.h2
        data-tour="hero-heading"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0, duration: 0.6 }}
        className="font-serif text-2xl md:text-4xl lg:text-5xl max-w-4xl text-text-primary leading-tight mb-6"
      >
        Billions in RWA capital is sleeping on Mantle. <br className="hidden md:block"/>
        <span className="text-accent italic">ARIA wakes it up.</span>
      </motion.h2>

      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3, duration: 0.6 }}
        className="text-text-secondary text-base md:text-xl max-w-2xl mb-12"
      >
        An autonomous intelligence agent that continuously scans, evaluates, and executes
        yield-optimizing reallocations for Real World Assets on the Mantle blockchain.
      </motion.p>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5, duration: 0.6 }}
        className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto"
      >
        <button
          data-tour="connect-wallet"
          className="w-full sm:w-auto bg-accent text-white px-8 py-3.5 rounded-sm font-semibold tracking-wide hover:opacity-90 transition-opacity"
          onClick={openConnectModal}
        >
          Connect Wallet
        </button>
        <button
          onClick={() => window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' })}
          className="w-full sm:w-auto bg-transparent border border-soft text-text-primary px-8 py-3.5 rounded-sm font-medium hover:bg-bg-soft transition-colors flex items-center justify-center gap-2"
        >
          Learn More <span>↓</span>
        </button>
      </motion.div>
    </section>
  );
};

export default HeroSection;
