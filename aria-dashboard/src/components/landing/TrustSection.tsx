import { motion } from 'framer-motion';

const TrustSection = () => {
  const bulletPoints = [
    { title: 'No human bottleneck', description: 'Unlike manual dashboards, ARIA acts on insights the millisecond they are detected.' },
    { title: 'Probabilistic modeling', description: 'Not just rule-based thresholds. ARIA weighs risk factors continuously across millions of data points.' },
    { title: 'Institutional custody', description: 'Your funds never leave the core smart contracts. ARIA only holds execution authority.' },
    { title: 'Natural language reporting', description: 'Every action ARIA takes is explained in plain English. Full transparency, zero obfuscation.' }
  ];

  return (
    <section className="py-24 md:py-32 bg-bg-soft">
      <div className="max-w-7xl mx-auto px-6 md:px-12 lg:px-24">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 lg:gap-24">
          <motion.div 
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
          >
            <h2 className="font-serif text-4xl md:text-5xl font-bold text-text-primary leading-tight sticky top-32">
              Not a dashboard. <br/>
              <span className="text-accent italic">An agent.</span>
            </h2>
          </motion.div>

          <div className="flex flex-col">
            {bulletPoints.map((point, i) => (
              <motion.div 
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.15, duration: 0.6 }}
                className={`py-8 ${i !== 0 ? 'border-t border-soft' : 'pt-0'}`}
              >
                <h4 className="font-serif text-xl font-bold text-text-primary mb-3">{point.title}</h4>
                <p className="text-text-secondary leading-relaxed">{point.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default TrustSection;
