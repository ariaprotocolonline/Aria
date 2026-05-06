import { useRef } from 'react';
import CountUp from 'react-countup';
import { useInView } from 'framer-motion';

const LiveStatsBar = () => {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-50px" });

  const stats = [
    { label: 'Total Capital Managed', value: 42500000, prefix: '$', decimals: 0 },
    { label: 'Reallocations Executed', value: 14205, prefix: '', decimals: 0 },
    { label: 'Slippage Avoided', value: 315420.50, prefix: '$', decimals: 2 },
    { label: 'Agent Uptime', value: 99.99, prefix: '', suffix: '%', decimals: 2 }
  ];

  return (
    <section className="bg-[#0F1110] py-20 text-white" ref={ref}>
      <div className="max-w-7xl mx-auto px-6 md:px-12 lg:px-24">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-12">
          {stats.map((stat, i) => (
            <div key={i} className="flex flex-col gap-2">
              <span className="text-[#8B8E8C] text-xs font-bold tracking-widest uppercase">
                {stat.label}
              </span>
              <div className="font-mono text-3xl md:text-4xl text-[#A9B8A9] font-medium tracking-tight">
                {stat.prefix}
                {isInView ? (
                  <CountUp 
                    end={stat.value} 
                    duration={2.5} 
                    decimals={stat.decimals}
                    separator=","
                  />
                ) : '0'}
                {stat.suffix}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default LiveStatsBar;
