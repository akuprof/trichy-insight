import { ArrowUpRight, Building2, Flame, Landmark, Store } from "lucide-react";

const categories = [
  {
    icon: Building2,
    title: "குடிமை பிரச்சனைகள்",
    id: "civic",
    description: "சாலை நிலை, தண்ணீர், உட்கட்டமைப்பு — தரை மட்ட விசாரணை அறிக்கைகள்.",
    count: "24",
    countLabel: "அறிக்கைகள்",
    accent: "text-blue-400",
    bar: "bg-blue-500",
  },
  {
    icon: Landmark,
    title: "அரசியல் பகுப்பாய்வு",
    id: "political",
    description: "உண்மைச் சரிபார்ப்பு, அறிக்கை ஆய்வு, தேர்தல் செய்தி.",
    count: "18",
    countLabel: "அறிக்கைகள்",
    accent: "text-purple-400",
    bar: "bg-purple-500",
  },
  {
    icon: Flame,
    title: "வைரல்",
    id: "viral",
    description: "டிரெண்டாகும் கதைகள், தெரு எதிர்வினைகள், இளைஞர் துடிப்பு.",
    count: "32",
    countLabel: "வீடியோக்கள்",
    accent: "text-[#DC2626]",
    bar: "bg-[#DC2626]",
  },
  {
    icon: Store,
    title: "வணிக சிறப்புப் பதிவு",
    id: "business",
    description: "உள்ளூர் வணிகக் கதைகள், சந்தை பார்வைகள், பொருளாதார ஆய்வுகள்.",
    count: "12",
    countLabel: "சிறப்புகள்",
    accent: "text-emerald-400",
    bar: "bg-emerald-500",
  },
];

const CategorySection = () => {
  return (
    <section className="bg-[#0F172A] text-white py-12 sm:py-16">
      <div className="container">
        {/* Section header */}
        <div className="flex items-center gap-3 mb-10">
          <div className="w-1 h-8 bg-[#DC2626] shrink-0" />
          <div>
            <h2 className="font-heading text-2xl sm:text-3xl uppercase text-white">எங்கள் செய்தி கவனம்</h2>
            <p className="text-slate-400 text-sm mt-0.5">திருச்சியின் ஒவ்வொரு துறையிலும் ஆழமான செய்தி</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {categories.map((cat) => (
            <a
              key={cat.id}
              href={`#${cat.id}`}
              className="group relative bg-slate-800/50 border border-white/5 hover:border-white/20 p-6 transition-all duration-300 hover:shadow-xl hover:-translate-y-0.5 overflow-hidden"
            >
              {/* Top accent bar */}
              <div className={`absolute top-0 left-0 right-0 h-0.5 ${cat.bar} transform origin-left scale-x-0 group-hover:scale-x-100 transition-transform duration-300`} />

              {/* Top row */}
              <div className="flex items-start justify-between mb-5">
                <div className={`p-2.5 bg-slate-700/50 rounded-sm ${cat.accent}`}>
                  <cat.icon className="h-5 w-5" />
                </div>
                <ArrowUpRight className={`h-4 w-4 ${cat.accent} opacity-0 group-hover:opacity-100 transition-all -translate-y-1 group-hover:translate-y-0`} />
              </div>

              <h3 className="font-heading text-sm sm:text-base uppercase leading-tight mb-2 text-white">{cat.title}</h3>
              <p className="text-slate-400 text-xs leading-relaxed line-clamp-2">{cat.description}</p>

              {/* Count badge */}
              <div className="flex items-center gap-1.5 mt-5 pt-4 border-t border-white/10">
                <span className={`font-heading text-xl font-bold leading-none ${cat.accent}`}>{cat.count}</span>
                <span className="text-slate-500 text-xs">{cat.countLabel}</span>
              </div>
            </a>
          ))}
        </div>
      </div>
    </section>
  );
};

export default CategorySection;
