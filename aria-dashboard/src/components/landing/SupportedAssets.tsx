import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';

const SupportedAssets = () => {
  const assets = [
    {
      name: 'Wrapped Ether',
      symbol: 'WETH',
      protocol: 'Agni Finance / FusionX',
      apy: '8.2%',
      tvl: '$124.5M',
      image: '/assets/gold.jpeg',
      description: 'Wrapped ETH deployed across concentrated liquidity pools on Mantle for optimised yield.',
      comingSoon: false,
    },
    {
      name: 'USD Coin',
      symbol: 'USDC',
      protocol: 'Agni Finance / FusionX',
      apy: '4.2%',
      tvl: '$89.0M',
      image: '/assets/new_gold.jpg',
      description: 'Stable USDC liquidity rotated between Agni Finance and FusionX for consistent yield.',
      comingSoon: false,
    },
    {
      name: 'xStocks',
      symbol: 'xSTK',
      protocol: 'Fluxion DEX',
      apy: null,
      tvl: null,
      image: '/assets/city.jpeg',
      description: 'Tokenized US equities trading 24/7 onchain: TSLAx, NVDAx, AAPLx, METAx, GOOGLx, SPYx, QQQx and more. Trade Tesla, Apple, and Nvidia via Fluxion DEX — backed 1:1 by real securities.',
      comingSoon: true,
    },
  ];

  return (
    <section className="py-24 border-b border-soft bg-bg">
      <div className="max-w-7xl mx-auto px-6 md:px-12 lg:px-24">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-12 gap-6">
          <div>
            <h3 className="font-serif text-3xl font-bold text-text-primary mb-4">Real World Assets</h3>
            <p className="text-text-secondary max-w-xl">
              ARIA integrates directly with Mantle's deepest liquidity layers, ensuring highly efficient execution across leading RWA protocols.
            </p>
          </div>
          <button className="text-accent text-sm font-semibold tracking-wide flex items-center gap-2 hover:opacity-80 transition-opacity">
            View All Integrations <ArrowRight size={16} />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {assets.map((asset, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.2, duration: 0.6 }}
              className={`group border rounded-sm bg-card overflow-hidden flex flex-col cursor-pointer transition-colors ${
                asset.comingSoon
                  ? 'border-accent/30 hover:border-accent/60'
                  : 'border-soft hover:border-text-secondary'
              }`}
            >
              {/* Image Header */}
              <div className="h-48 w-full overflow-hidden relative border-b border-soft">
                <div className={`absolute inset-0 z-10 transition-colors ${asset.comingSoon ? 'bg-black/40 group-hover:bg-black/30' : 'bg-black/10 group-hover:bg-transparent'}`} />
                <img
                  src={asset.image}
                  alt={asset.name}
                  className="w-full h-full object-cover transform group-hover:scale-105 transition-transform duration-700"
                />
                {asset.comingSoon && (
                  <div className="absolute top-3 right-3 z-20 bg-accent/20 border border-accent/40 text-accent text-xs font-semibold tracking-widest uppercase px-3 py-1 rounded-full backdrop-blur-sm">
                    Coming Soon
                  </div>
                )}
              </div>

              {/* Card Body */}
              <div className="p-8 flex-1 flex flex-col">
                <div className="flex justify-between items-start mb-6">
                  <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-full bg-bg border flex items-center justify-center font-bold text-text-primary shadow-sm ${asset.comingSoon ? 'border-accent/40' : 'border-soft'}`}>
                      {asset.comingSoon ? '✦' : asset.symbol.substring(0, 1)}
                    </div>
                    <div>
                      <h4 className="font-semibold text-text-primary text-lg">{asset.name}</h4>
                      <span className="text-sm text-text-secondary">{asset.protocol}</span>
                    </div>
                  </div>
                  <div className={`w-8 h-8 rounded-full border flex items-center justify-center transition-colors ${asset.comingSoon ? 'border-accent/40 group-hover:bg-accent group-hover:text-bg' : 'border-soft group-hover:bg-text-primary group-hover:text-bg'}`}>
                    <ArrowRight size={14} />
                  </div>
                </div>

                <p className="text-sm text-text-secondary leading-relaxed mb-8 flex-1">
                  {asset.description}
                </p>

                {asset.comingSoon ? (
                  <div className="pt-6 border-t border-soft">
                    <div className="text-xs font-semibold tracking-widest text-text-secondary uppercase mb-2">Available Assets</div>
                    <div className="flex flex-wrap gap-1.5">
                      {['TSLAx', 'NVDAx', 'AAPLx', 'METAx', 'GOOGLx', 'SPYx', 'QQQx', 'MSTRx'].map(sym => (
                        <span key={sym} className="font-mono text-xs text-accent/80 bg-accent/10 border border-accent/20 px-2 py-0.5 rounded">
                          {sym}
                        </span>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="flex gap-12 pt-6 border-t border-soft">
                    <div>
                      <div className="text-xs font-semibold tracking-widest text-text-secondary uppercase mb-1">Live APY</div>
                      <div className="font-mono text-2xl text-accent font-medium">{asset.apy}</div>
                    </div>
                    <div>
                      <div className="text-xs font-semibold tracking-widest text-text-secondary uppercase mb-1">Protocol TVL</div>
                      <div className="font-mono text-2xl text-text-primary font-medium">{asset.tvl}</div>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default SupportedAssets;
