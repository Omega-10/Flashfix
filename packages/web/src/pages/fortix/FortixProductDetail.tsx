import { useParams, Link } from "react-router-dom";
import Product360Viewer from "@/components/fortix/Product360Viewer";
import { ArrowLeft, ShieldCheck, Zap } from "lucide-react";

export default function FortixProductDetail() {
  const { id } = useParams();

  // In a real app, you'd fetch the product details by ID here.
  
  return (
    <div className="pt-24 pb-20 bg-[var(--surface-bg)] min-h-screen text-[var(--text-primary)] font-sans">
      <div className="section-container">
        <Link to="/fortix" className="inline-flex items-center gap-2 text-[var(--text-muted)] hover:text-[var(--accent-amber)] transition-colors mb-8 text-sm font-medium">
          <ArrowLeft className="w-4 h-4" />
          Back to Fortix
        </Link>
        
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-24">
          {/* 3D Viewer Left Side */}
          <div className="h-[500px] lg:h-[700px] rounded-3xl overflow-hidden bg-[var(--surface-elevated)] border border-[var(--surface-border)]">
            <Product360Viewer />
          </div>

          {/* Product Info Right Side */}
          <div className="flex flex-col justify-center">
            <span className="text-[var(--accent-amber)] font-mono text-sm tracking-widest uppercase mb-4 block">Premium Accessory</span>
            <h1 className="font-display font-bold text-[clamp(40px,5vw,64px)] leading-[1.1] mb-4">
              Fortix Armor
            </h1>
            <p className="text-2xl font-mono text-[var(--text-primary)] mb-8">₹1,499</p>

            <p className="text-[var(--text-secondary)] text-lg font-light leading-relaxed mb-10 border-b border-[var(--surface-border)] pb-10">
              Military-grade durability. Designed for those who demand absolute protection without sacrificing the device's original aesthetic.
            </p>

            <div className="space-y-6 mb-12">
              <div className="flex items-start gap-4">
                <ShieldCheck className="w-6 h-6 text-[var(--accent-amber)] shrink-0" />
                <div>
                  <h4 className="font-semibold text-[var(--text-primary)]">Drop-Tested Protection</h4>
                  <p className="text-[var(--text-muted)] text-sm">Survives 15ft drops onto concrete.</p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <Zap className="w-6 h-6 text-[var(--accent-amber)] shrink-0" />
                <div>
                  <h4 className="font-semibold text-[var(--text-primary)]">MagSafe Compatible</h4>
                  <p className="text-[var(--text-muted)] text-sm">Built-in magnetic ring for seamless charging.</p>
                </div>
              </div>
            </div>

            <div className="flex gap-4">
              <button className="flex-1 bg-[var(--accent-amber)] hover:bg-[#d87c09] text-black font-semibold text-lg px-8 py-4 rounded-xl transition-all duration-300">
                Add to Cart
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
