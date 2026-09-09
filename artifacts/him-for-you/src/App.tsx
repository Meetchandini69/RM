import { PageMeta } from "@/pages/seo";
import { useDiscoveryOptions } from "@/pages/discovery-options";
import { AccountMenu, WomenPanel } from "@/pages/account-panels";
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import ViewerAccess, { useViewer, UnlockNotice } from '@/pages/viewer-access';
import Registration, { MemberArea, RegistrationAdmin, RegistrationPolicy } from '@/pages/registration';
import {
  ArrowUpRight,
  BadgeCheck,
  Bell,
  Bookmark,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  CircleUserRound,
  Clock3,
  Compass,
  Gem,
  Heart,
  LockKeyhole,
  MapPin,
  Menu,
  MessageCircle,
  Search,
  Send,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  X,
} from 'lucide-react';
import {
  getGetFeaturedProfilesQueryKey,
  getGetProfileQueryKey,
  getListCitiesQueryKey,
  getListPlansQueryKey,
  getListProfilesQueryKey,
  useGetDiscoverySummary,
  useGetFeaturedProfiles,
  useGetProfile,
  useListCities,
  useListPlans,
  useListProfiles,
  useSendInterest,
  useToggleFavorite,
} from '@workspace/api-client-react';
import type {
  ListProfilesParams,
  Plan,
  Profile,
  ProfileDetail,
} from '@workspace/api-client-react';
import {
  Route,
  Switch,
  useLocation,
  useParams,
  Router as WouterRouter,
  Link,
} from 'wouter';

const queryClient = new QueryClient();

const localPhotos: Record<string, string> = {
  rahul: '/assets/rahul-profile.jpg',
  arjun: '/assets/arjun-profile.jpg',
  vikram: '/assets/vikram-profile.jpg',
  karan: '/assets/karan-profile.jpg',
  aditya: '/assets/aditya-profile.jpg',
};

function photoFor(profile: Pick<Profile, 'imageUrl' | 'slug' | 'displayName'>) {
  if (profile.slug.startsWith('member-')) return profile.imageUrl;
  const key = `${profile.slug}-${profile.displayName}`.toLowerCase();
  const localKey = Object.keys(localPhotos).find((name) => key.includes(name));
  return (localKey && localPhotos[localKey]) || profile.imageUrl;
}

function initials(name: string) {
  return name.split(' ').map((part) => part[0]).slice(0, 2).join('');
}

function ErrorState({ onRetry, label = 'We could not load this just now.' }: { onRetry: () => void; label?: string }) {
  return (
    <div className="rounded-2xl border hairline bg-card/70 px-6 py-10 text-center" data-testid="status-error">
      <div className="mx-auto mb-4 flex h-11 w-11 items-center justify-center rounded-full border border-primary/30 bg-primary/10 text-primary">
        <Compass size={18} />
      </div>
      <p className="font-editorial text-xl text-foreground">{label}</p>
      <p className="mt-2 text-sm text-muted-foreground">Please try again in a moment.</p>
      <button className="mt-5 rounded-full border border-accent/45 px-5 py-2 text-xs font-semibold uppercase tracking-[.18em] text-accent transition hover:bg-accent hover:text-background" onClick={onRetry} data-testid="button-retry">
        Try again
      </button>
    </div>
  );
}

function ProfileSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: count }).map((_, index) => (
        <div className="overflow-hidden rounded-2xl border hairline bg-card" key={index} data-testid={`skeleton-profile-${index}`}>
          <div className="h-[350px] animate-pulse bg-muted/80" />
          <div className="space-y-3 p-5">
            <div className="h-5 w-2/3 animate-pulse rounded bg-muted/80" />
            <div className="h-3 w-1/2 animate-pulse rounded bg-muted/80" />
            <div className="h-3 w-full animate-pulse rounded bg-muted/80" />
          </div>
        </div>
      ))}
    </div>
  );
}

function ProfileCard({ profile, featured = false }: { profile: Profile; featured?: boolean }) {
  const viewer = useViewer();
  const queryClient = useQueryClient();
  const [saved, setSaved] = useState(false);
  const favoriteMutation = useToggleFavorite();

  const toggleSaved = () => {
    favoriteMutation.mutate({ id: profile.id }, {
      onSuccess: (result) => {
        setSaved(result.isFavourite ?? !saved);
        queryClient.invalidateQueries({ queryKey: getListProfilesQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetFeaturedProfilesQueryKey() });
      },
    });
  };

  return (
    <article className="profile-card group relative overflow-hidden rounded-2xl border hairline bg-card" data-testid={`card-profile-${profile.id}`}>
      <Link href={`/profile/${profile.slug}`} className="block focus-ring" data-testid={`link-profile-${profile.id}`}>
        <div className="relative h-[350px] overflow-hidden bg-muted">
          {photoFor(profile) ? (
            <img src={photoFor(profile)} alt={`${profile.displayName} profile`} className={`profile-image h-full w-full object-cover ${viewer.data ? "photos-unlocked" : ""}`} data-testid={`img-profile-${profile.id}`} />
          ) : (
            <div className="flex h-full items-center justify-center bg-secondary text-5xl font-editorial text-accent" data-testid={`img-fallback-${profile.id}`}>{initials(profile.displayName)}</div>
          )}
          <div className="image-fade absolute inset-0" />
          <div className="absolute left-4 top-4 flex gap-2">
            {featured && <span className="rounded-full bg-accent px-3 py-1 text-[10px] font-bold uppercase tracking-[.16em] text-background">Curated</span>}
            {profile.isPremium && <span className="rounded-full border border-accent/50 bg-background/70 px-3 py-1 text-[10px] font-bold uppercase tracking-[.16em] text-accent backdrop-blur">Private</span>}
          </div>
          {profile.isOnline && <span className="absolute bottom-4 right-4 flex items-center gap-2 rounded-full border border-foreground/20 bg-background/75 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[.14em] text-foreground backdrop-blur"><span className="h-1.5 w-1.5 rounded-full bg-[#b9d7a7]" />Available now</span>}
        </div>
        <div className="p-5 pb-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="font-editorial text-[27px] leading-none text-foreground">{profile.displayName}, {profile.age}</h3>
              <p className="mt-2 flex items-center gap-1.5 text-xs uppercase tracking-[.13em] text-muted-foreground"><MapPin size={12} className="text-accent" />{profile.city}</p>
            </div>
            {profile.isVerified && <BadgeCheck className="mt-1 shrink-0 text-accent" size={20} aria-label="Verified profile" />}
          </div>
          <p className="mt-4 line-clamp-2 text-sm leading-6 text-muted-foreground">{profile.headline}</p>
          <div className="mt-5 flex items-center justify-between border-t hairline pt-4">
            <span className="text-xs text-muted-foreground">{profile.lookingFor?.[0] || 'Meaningful connection'}</span>
            <span className="flex items-center gap-1 text-xs font-semibold text-accent">View profile <ArrowUpRight size={14} /></span>
          </div>
        </div>
      </Link>
      <button className={`absolute right-4 top-4 z-10 flex h-9 w-9 items-center justify-center rounded-full border backdrop-blur transition ${saved ? 'border-primary bg-primary text-foreground' : 'border-foreground/20 bg-background/65 text-foreground hover:border-accent hover:text-accent'}`} onClick={toggleSaved} disabled={favoriteMutation.isPending} aria-label={saved ? 'Remove from saved profiles' : 'Save profile'} data-testid={`button-favorite-${profile.id}`}>
        <Heart size={16} fill={saved ? 'currentColor' : 'none'} />
      </button>
    </article>
  );
}

function Shell({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const [open, setOpen] = useState(false);
  const isBrowse = location.startsWith('/men');
  return (
    <div className="noise min-h-[100dvh] bg-background text-foreground">
      <header className="sticky top-0 z-50 border-b border-foreground/10 bg-background/90 backdrop-blur-xl">
        <div className="mx-auto flex h-[72px] max-w-[1320px] items-center justify-between px-5 sm:px-8 lg:px-12">
          <Link href="/" className="group flex items-center gap-3 focus-ring" onClick={() => setOpen(false)} data-testid="link-logo">
            <img src="/rm-logo.png" alt="Men For You logo" width={457} height={546} className="h-12 w-auto shrink-0 object-contain" />
            <span className="font-editorial text-[23px] tracking-[-.02em] text-foreground">men <span className="text-primary">for</span> you</span>
          </Link>
          <nav className="hidden items-center gap-4 xl:gap-7 xl:flex" aria-label="Main navigation">
            <Link href="/" className={`underlined-link text-[11px] font-semibold uppercase tracking-[.14em] transition ${location === '/' ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'}`} data-testid="link-home">Home</Link>
            <Link href="/men" className={`underlined-link text-[11px] font-semibold uppercase tracking-[.14em] transition ${isBrowse ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'}`} data-testid="link-browse">Browse Men</Link>
            <a href="#how-it-works" className="underlined-link text-[11px] font-semibold uppercase tracking-[.14em] text-muted-foreground transition hover:text-foreground" data-testid="link-how-it-works">How It Works</a>
            <Link href="/premium" className={`underlined-link text-[11px] font-semibold uppercase tracking-[.14em] transition ${location === '/premium' ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'}`} data-testid="link-premium">Premium</Link>
            <a href="#popular-cities" className="underlined-link text-[11px] font-semibold uppercase tracking-[.14em] text-muted-foreground transition hover:text-foreground" data-testid="link-cities">Popular Cities</a>
            <a href="#footer" className="underlined-link text-[11px] font-semibold uppercase tracking-[.14em] text-muted-foreground transition hover:text-foreground" data-testid="link-blog">Blog</a>
          </nav>
          <div className="hidden items-center gap-3 xl:flex">
            <button className="text-muted-foreground transition hover:text-accent" aria-label="Notifications" data-testid="button-notifications"><Bell size={17} /></button>
            <span className="h-5 w-px bg-foreground/15" />
            <AccountMenu />
            <Link href="/dashboard" className="whitespace-nowrap rounded-md border border-accent/50 px-4 py-2.5 text-[10px] font-bold uppercase tracking-[.14em] text-accent hover:bg-accent/10" data-testid="link-header-men-login">Men login</Link>
            <Link href="/join" className="rounded-md bg-primary px-4 py-2.5 text-[10px] font-bold uppercase tracking-[.14em] text-foreground transition hover:bg-primary/85" data-testid="link-header-join">Join now</Link>
          </div>
          <button className="flex h-10 w-10 items-center justify-center rounded-full border border-foreground/15 text-foreground xl:hidden" onClick={() => setOpen(!open)} aria-label="Open navigation" data-testid="button-mobile-menu">{open ? <X size={18} /> : <Menu size={18} />}</button>
        </div>
        {open && (
          <div className="border-t border-foreground/10 bg-card px-5 py-5 xl:hidden" data-testid="mobile-navigation">
            <nav className="grid gap-1"><AccountMenu />
              <Link href="/dashboard" className="mt-3 rounded-md border border-accent/50 px-4 py-3 text-sm font-semibold text-accent" onClick={() => setOpen(false)} data-testid="mobile-link-men-login">Men login</Link>
              <Link href="/men" className="flex items-center justify-between border-b hairline py-4 text-sm font-semibold uppercase tracking-[.15em]" onClick={() => setOpen(false)} data-testid="mobile-link-browse">Discover men <ChevronRight size={16} className="text-accent" /></Link>
              <Link href="/premium" className="flex items-center justify-between border-b hairline py-4 text-sm font-semibold uppercase tracking-[.15em]" onClick={() => setOpen(false)} data-testid="mobile-link-premium">Membership <ChevronRight size={16} className="text-accent" /></Link>
              <Link href="/join" className="flex items-center justify-between py-4 text-sm font-semibold uppercase tracking-[.15em]" onClick={() => setOpen(false)} data-testid="mobile-link-join">For men <ChevronRight size={16} className="text-accent" /></Link>
            </nav>
          </div>
        )}
      </header>
      <main>{children}</main>
       <footer id="footer" className="border-t border-foreground/10 bg-[#0d0d0f]">
         <div className="mx-auto grid max-w-[1320px] gap-10 px-5 py-12 sm:px-8 md:grid-cols-[1.5fr_1fr_1fr_1fr] lg:px-12 lg:py-16">
          <div>
            <div className="flex items-center gap-3"><img src="/rm-logo.png" alt="Men For You logo" width={457} height={546} className="h-12 w-auto shrink-0 object-contain" /><span className="font-editorial text-xl">men <span className="text-primary">for</span> you</span></div>
             <p className="mt-5 max-w-xs text-sm leading-6 text-muted-foreground">A premium dating and companionship platform for women who know what they want.</p>
             <div className="mt-7 flex gap-2 text-[10px] font-semibold uppercase tracking-[.14em] text-muted-foreground"><span className="rounded-full border border-foreground/15 px-3 py-1.5">Private</span><span className="rounded-full border border-foreground/15 px-3 py-1.5">18+ only</span></div>
          </div>
          <div>
             <p className="font-mono-label text-[10px] uppercase tracking-[.2em] text-accent">Platform</p>
             <div className="mt-4 grid gap-3 text-sm text-muted-foreground"><Link href="/men" className="hover:text-foreground" data-testid="footer-link-men">Browse men</Link><a href="#popular-cities" className="hover:text-foreground" data-testid="footer-link-cities">Popular cities</a><Link href="/premium" className="hover:text-foreground" data-testid="footer-link-premium">Premium membership</Link><a href="#how-it-works" className="hover:text-foreground" data-testid="footer-link-how">How it works</a></div>
          </div>
          <div>
             <p className="font-mono-label text-[10px] uppercase tracking-[.2em] text-accent">Members</p>
             <div className="mt-4 grid gap-3 text-sm text-muted-foreground"><Link href="/join" className="hover:text-foreground" data-testid="footer-link-create">Create profile</Link><Link href="/login" className="hover:text-foreground" data-testid="footer-link-login">Login</Link><Link href="/premium" className="hover:text-foreground" data-testid="footer-link-upgrade">Upgrade profile</Link><Link href="/dashboard" className="hover:text-foreground" data-testid="footer-link-manage">Manage profile</Link></div>
           </div>
           <div>
             <p className="font-mono-label text-[10px] uppercase tracking-[.2em] text-accent">Information</p>
             <div className="mt-4 grid gap-3 text-sm text-muted-foreground"><Link href="/privacy">Privacy policy</Link><Link href="/terms">Terms &amp; conditions</Link><a href="/sitemap.html">Sitemap</a><span>Safety guidelines</span><span>Contact us</span></div>
          </div>
        </div>
         <div className="mx-auto flex max-w-[1320px] flex-col gap-2 border-t border-foreground/10 px-5 py-5 text-[10px] uppercase tracking-[.16em] text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-8 lg:px-12"><span>© 2025 Men For You. All rights reserved.</span><span>For consenting adults only · Your privacy. Your choice.</span></div>
      </footer>
    </div>
  );
}

function Home() {
  const [chosenCity, setChosenCity] = useState('');
  const [intent, setIntent] = useState('');
  const [ageRange, setAgeRange] = useState('21 - 50+');
  const [, setLocation] = useLocation();
  const summary = useGetDiscoverySummary();
  const featured = useGetFeaturedProfiles({}, { query: { queryKey: getGetFeaturedProfilesQueryKey({}) } });
  const searchOptions = useDiscoveryOptions();
  const cities = useListCities({ query: { queryKey: getListCitiesQueryKey(), refetchInterval: 30000 } });
  const plans = useListPlans({ query: { queryKey: getListPlansQueryKey() } });
  const featuredProfiles = featured.data ?? [];
  return (
    <div>
      <section className="hero-reference relative min-h-[645px] border-b border-foreground/10">
        <img src="/assets/him-for-you-hero.jpg" alt="Couple sharing a private moment" width="1600" height="900" className="absolute inset-0 h-full w-full object-cover object-[68%_center]" />
        <div className="absolute inset-0 bg-[linear-gradient(90deg,#080709_0%,rgba(8,7,9,.96)_28%,rgba(8,7,9,.58)_58%,rgba(8,7,9,.12)_100%)]" />
        <div className="relative mx-auto flex min-h-[645px] max-w-[1320px] flex-col justify-center px-5 pt-20 sm:px-8 lg:px-12">
          <div className="reveal max-w-[590px]">
            <p className="mb-4 font-mono-label text-[10px] uppercase tracking-[.2em] text-accent">For women who know what they want</p>
            <h1 className="max-w-[570px] font-editorial text-[clamp(3rem,6.4vw,6.2rem)] leading-[.92] tracking-[-.055em] text-[#fff8ee]">Find the Right Man <em className="text-accent">For Your Moments</em></h1>
            <p className="mt-6 max-w-[535px] text-sm leading-6 text-[#f3e8dc]/80 sm:text-[15px]">Meet attractive, interesting and verified men near you. Whether you’re looking for dating, companionship, a dinner partner, travel company or a meaningful private connection, discover profiles that match your preferences.</p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <button className="group flex items-center justify-center gap-3 rounded-md bg-primary px-6 py-3.5 text-[11px] font-bold uppercase tracking-[.12em] text-foreground transition hover:bg-primary/85" onClick={() => setLocation(chosenCity ? `/men/${chosenCity}` : '/men')} data-testid="button-start-discovery">Find Men Near You <ArrowUpRight size={15} className="transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" /></button>
              <Link href="/join" className="flex items-center justify-center gap-3 rounded-md border border-[#f3e8dc]/40 bg-black/20 px-6 py-3.5 text-[11px] font-bold uppercase tracking-[.12em] text-[#fff8ee] transition hover:border-accent hover:text-accent" data-testid="link-create-profile">Create Your Profile <ChevronRight size={15} /></Link>
            </div>
            <div className="mt-7 flex flex-wrap gap-x-5 gap-y-2 text-[10px] text-[#f3e8dc]/80">
              <span className="flex items-center gap-1.5"><LockKeyhole size={12} className="text-accent" /> Private &amp; discreet</span>
              <span className="flex items-center gap-1.5"><ShieldCheck size={12} className="text-accent" /> Verified profiles</span>
              <span className="flex items-center gap-1.5"><BadgeCheck size={12} className="text-accent" /> Adults only (18+)</span>
            </div>
          </div>
          <div className="search-reference relative z-10 -mb-20 mt-8 shrink-0 rounded-lg border border-foreground/20 bg-[#171619]/95 p-4 shadow-2xl backdrop-blur-md sm:p-5">
            <div className="mb-4 flex items-end justify-between"><div><h2 className="font-editorial text-2xl text-[#fff8ee]">Find Your Perfect Match</h2><p className="mt-1 text-xs text-muted-foreground">Search men based on your preferences and location.</p></div><Search size={18} className="hidden text-accent sm:block" /></div>
            <div className="grid gap-3 md:grid-cols-[1.05fr_1.05fr_.8fr_auto]">
              <label className="grid gap-1.5 text-[10px] font-semibold uppercase tracking-[.12em] text-muted-foreground">Location<select className="h-11 rounded-md border border-foreground/15 bg-[#0f0e10] px-3 text-xs font-normal normal-case tracking-normal text-foreground outline-none focus:border-accent" value={chosenCity} onChange={(event) => setChosenCity(event.target.value)} data-testid="select-home-city"><option value="">Select city</option>{(cities.data ?? []).map((city) => <option value={city.slug} key={city.id}>{city.name}</option>)}</select></label>
              <label className="grid gap-1.5 text-[10px] font-semibold uppercase tracking-[.12em] text-muted-foreground">I’m looking for<select className="h-11 rounded-md border border-foreground/15 bg-[#0f0e10] px-3 text-xs font-normal normal-case tracking-normal text-foreground outline-none focus:border-accent" value={intent} onChange={(event) => setIntent(event.target.value)} data-testid="select-home-intent"><option value="">Any preference</option>{searchOptions.data?.lookingFor.map(option => <option key={option} value={option}>{option}</option>)}</select></label>
              <label className="grid gap-1.5 text-[10px] font-semibold uppercase tracking-[.12em] text-muted-foreground">Age<select className="h-11 rounded-md border border-foreground/15 bg-[#0f0e10] px-3 text-xs font-normal normal-case tracking-normal text-foreground outline-none focus:border-accent" value={ageRange} onChange={(event) => setAgeRange(event.target.value)} data-testid="select-home-age"><option>21 - 50+</option><option>21 - 30</option><option>31 - 40</option><option>41 - 50+</option></select></label>
              <button className="mt-auto flex h-11 items-center justify-center gap-2 rounded-md bg-primary px-5 text-[10px] font-bold uppercase tracking-[.12em] text-foreground transition hover:bg-primary/85" onClick={() => setLocation(chosenCity ? `/men/${chosenCity}` : '/men')} data-testid="button-browse-men"><Search size={14} /> Browse Men</button>
            </div>
          </div>
        </div>
      </section>
      <section id="private-massage" className="bg-background px-5 pb-10 pt-28 sm:px-8 lg:px-12" aria-labelledby="massage-heading">
        <div className="relative mx-auto grid max-w-[1224px] overflow-hidden rounded-2xl border border-accent/50 bg-gradient-to-br from-[#49203b] via-[#251b27] to-[#171619] shadow-[0_20px_70px_rgba(218,71,151,0.16)] md:grid-cols-[1.4fr_.6fr]">
          <div className="relative z-10 p-7 sm:p-10 lg:p-12">
            <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-accent/40 bg-accent/10 px-4 py-2 text-[10px] font-bold uppercase tracking-[.18em] text-accent"><Sparkles size={14} /> A moment just for you</p>
            <h2 id="massage-heading" className="font-editorial text-4xl leading-tight text-[#fff8ee] sm:text-5xl">Private Massage for Women<br /><em className="text-accent">By Men.</em></h2>
            <p className="mt-5 max-w-xl text-sm leading-7 text-[#f3e8dc]/80">Make time to unwind with a private massage experience. Connect with men and discuss your preferences, comfort and availability before arranging a session.</p>
            <div className="mt-6 flex flex-wrap gap-3 text-xs text-[#fff8ee]">
              <span className="rounded-full border border-white/15 px-3 py-2">Your comfort comes first</span>
              <span className="rounded-full border border-white/15 px-3 py-2">At your pace</span>
              <span className="rounded-full border border-white/15 px-3 py-2">For adults 18+</span>
            </div>
            <Link href="/men" className="mt-8 inline-flex items-center justify-center gap-3 rounded-md bg-primary px-6 py-4 text-xs font-bold uppercase tracking-[.12em] text-white transition hover:bg-primary/85" data-testid="link-massage-explore">Explore Men Near You <ArrowUpRight size={16} /></Link>
          </div>
          <div className="relative min-h-[260px] overflow-hidden border-t border-accent/20 md:border-l md:border-t-0">
            <img src="/assets/arjun-profile.jpg" alt="Blurred portrait of a man" className="h-full min-h-[260px] w-full scale-110 object-cover blur-md md:absolute md:inset-0" loading="lazy" />
            <div className="absolute inset-0 bg-gradient-to-t from-[#171619] via-[#251b27]/30 to-transparent" />
            <div className="absolute inset-x-6 bottom-7 text-center"><Sparkles className="mx-auto mb-3 text-accent" size={28} /><p className="font-editorial text-2xl text-[#fff8ee]">Relax. Unwind. Reconnect.</p><p className="mt-2 text-xs text-[#f3e8dc]/75">A little time for yourself.</p></div>
          </div>
        </div>
      </section>
      <section className="bg-background">
        <div className="mx-auto max-w-[1320px] px-5 pb-5 sm:px-8 lg:px-12">
          <div className="mb-6 flex items-end justify-between gap-5"><div><h2 className="font-editorial text-3xl tracking-[-.03em] sm:text-4xl">Featured Men Near You</h2><p className="mt-1 text-xs text-muted-foreground">Discover men who are currently active and ready to connect with women looking for genuine companionship.</p></div><Link href="/men" className="hidden items-center gap-2 text-[10px] font-bold uppercase tracking-[.15em] text-primary sm:flex" data-testid="link-view-all">View all men <ArrowUpRight size={14} /></Link></div>
          {featured.isLoading ? <ProfileSkeleton count={5} /> : featured.isError ? <ErrorState onRetry={() => featured.refetch()} /> : featuredProfiles.length === 0 ? <div className="rounded-2xl border hairline p-12 text-center text-muted-foreground" data-testid="empty-featured">New profiles are arriving soon.</div> : <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">{featuredProfiles.map((profile) => <ProfileCard key={profile.id} profile={profile} featured />)}</div>}
          <Link href="/men" className="mt-6 flex items-center justify-center gap-2 text-[10px] font-bold uppercase tracking-[.15em] text-primary sm:hidden" data-testid="mobile-link-view-all">View all men <ArrowUpRight size={14} /></Link>
        </div>
      </section>
      <section className="relative mx-auto max-w-[1320px] px-5 py-14 sm:px-8 lg:px-12" aria-labelledby="colorful-moments-heading">
        <div className="rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/15 via-card to-accent/10 p-6 sm:p-10">
          <div className="mx-auto max-w-3xl text-center">
            <p className="font-mono-label text-[10px] uppercase tracking-[.2em] text-accent">A little spark. A beautiful memory.</p>
            <h2 id="colorful-moments-heading" className="mt-4 font-editorial text-4xl leading-tight sm:text-5xl">Make every moment<br /><em className="text-primary">a little more colorful.</em></h2>
            <p className="mt-5 text-sm leading-7 text-muted-foreground">You deserve laughter that comes easily, company that feels right, and moments that stay with you. Meet handsome men for a coffee, a special evening, or a new adventure. Let your next beautiful memory begin with a hello.</p>
          </div>
          <div className="mt-9 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[
              { icon: Heart, title: 'Coffee & Dating', text: 'A warm conversation, a shared smile, and the possibility of something lovely.' },
              { icon: Gem, title: 'Dinner & Evenings Out', text: 'Dress up, discover somewhere special, and enjoy charming company across the table.' },
              { icon: Compass, title: 'Travel Companionship', text: 'Explore new places and turn a change of scenery into a shared memory.' },
              { icon: CalendarDays, title: 'Events & Celebrations', text: 'Find company for a social evening, a celebration, or an occasion worth remembering.' },
              { icon: Sparkles, title: 'Private Massage', text: 'Take a pause for yourself. Discuss a relaxing session, your preferences, and your comfort.' },
              { icon: MessageCircle, title: 'Everyday Companionship', text: 'An unhurried walk, a weekend plan, or someone to share the little joys with.' },
            ].map(({ icon: Icon, title, text }) => <article key={title} className="rounded-xl border border-foreground/10 bg-background/60 p-5"><Icon size={22} className="text-accent" /><h3 className="mt-4 font-editorial text-2xl">{title}</h3><p className="mt-3 text-sm leading-6 text-muted-foreground">{text}</p></article>)}
          </div>
          <div className="mt-8 text-center"><Link href="/men" className="inline-flex items-center justify-center gap-3 rounded-md bg-primary px-6 py-4 text-xs font-bold uppercase tracking-[.12em] text-white transition hover:bg-primary/85" data-testid="link-colorful-moments">Find Your Kind of Company <ArrowUpRight size={16} /></Link><p className="mt-4 text-xs leading-5 text-muted-foreground">For adults 18+. Experiences depend on individual availability and mutual agreement.</p></div>
        </div>
      </section>
      <section id="how-it-works" className="mt-10 bg-[#f5f0e7] text-[#292323]">
        <div className="mx-auto max-w-[1320px] px-5 py-12 sm:px-8 lg:px-12 lg:py-14">
          <div className="text-center"><p className="font-mono-label text-[10px] uppercase tracking-[.2em] text-[#a12c63]">A better way to meet</p><h2 className="mt-2 font-editorial text-3xl sm:text-4xl">Simple. Private. Your Choice.</h2><p className="mt-2 text-xs text-[#6e625b]">Find and connect with men in just a few simple steps.</p></div>
          <div className="mt-9 grid gap-7 md:grid-cols-4">{[{icon: Search, title: 'Browse Profiles', text: 'Search men based on your city, age and interests.'}, {icon: Heart, title: 'Find Someone You Like', text: 'Explore profiles, photos and availability.'}, {icon: MessageCircle, title: 'Connect', text: 'Send your interest or contact someone you’re interested in.'}, {icon: CalendarDays, title: 'Meet Your Way', text: 'Plan a date, social outing or private companionship experience.'}].map(({icon: Icon, title, text}, index) => <div className="relative text-center md:border-r md:border-[#cdbfb4] md:last:border-0" key={title} data-testid={`step-how-${index + 1}`}><div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full border border-[#cdbfb4] bg-[#fbf8f2] text-[#a12c63]"><Icon size={17} /></div><p className="mt-3 text-[10px] font-bold uppercase tracking-[.16em] text-[#a12c63]">Step 0{index + 1}</p><h3 className="mt-2 font-editorial text-xl">{title}</h3><p className="mx-auto mt-2 max-w-[210px] text-xs leading-5 text-[#6e625b]">{text}</p></div>)}</div>
        </div>
      </section>
      <section className="bg-[#161416]">
        <div className="mx-auto grid max-w-[1320px] gap-6 px-5 py-12 sm:px-8 md:grid-cols-[.85fr_1fr_1fr] lg:px-12 lg:py-16">
          <div className="relative min-h-[300px] overflow-hidden rounded-lg"><img src="/assets/him-for-you-lifestyle.jpg" alt="Woman enjoying an evening out" width="1200" height="900" className="absolute inset-0 h-full w-full object-cover" /><div className="absolute inset-0 bg-gradient-to-t from-[#161416]/70 to-transparent" /></div>
          <div className="flex flex-col justify-center px-1 sm:px-4"><p className="font-mono-label text-[10px] uppercase tracking-[.2em] text-accent">Discover something different</p><h2 className="mt-3 font-editorial text-4xl leading-[.98] text-[#fff8ee] sm:text-5xl">Looking for Someone <em className="text-primary">Different?</em></h2><p className="mt-4 max-w-md text-sm leading-6 text-muted-foreground">Whether you want someone to accompany you to dinner, spend time with, travel with, enjoy a date or simply meet someone new, our platform makes discovering compatible people easier.</p><Link href="/men" className="mt-6 flex w-fit items-center gap-2 rounded-md bg-primary px-5 py-3 text-[10px] font-bold uppercase tracking-[.14em] text-foreground" data-testid="link-start-browsing">Start browsing <ArrowUpRight size={14} /></Link></div>
          <div className="rounded-lg border border-foreground/10 bg-[#211f20] p-6 sm:p-8"><h3 className="font-editorial text-2xl text-[#fff8ee]">You Decide What You’re Looking For</h3><div className="mt-6 grid gap-3 text-xs text-[#f0e5d9] sm:grid-cols-2">{['Dating', 'Weekend Company', 'Dinner & Social Companion', 'Private Adult Dating', 'Travel Companion', 'Casual Connections', 'Events & Parties', 'Long-Term Dating'].map((item) => <span className="flex items-center gap-2" key={item}><CheckCircle2 size={14} className="shrink-0 text-accent" />{item}</span>)}</div><p className="mt-7 border-t border-foreground/10 pt-5 text-xs italic text-muted-foreground">Your preferences. Your privacy. Your choice.</p></div>
        </div>
      </section>
      <section className="bg-[#f5f0e7] text-[#292323]">
        <div className="mx-auto max-w-[1320px] px-5 py-12 sm:px-8 lg:px-12 lg:py-14">
          <div className="text-center"><p className="font-mono-label text-[10px] uppercase tracking-[.2em] text-[#a12c63]">Choose your visibility</p><h2 className="mt-2 font-editorial text-3xl sm:text-4xl">Get More Profile Views With Premium</h2><p className="mt-2 text-xs text-[#6e625b]">Stand out from other profiles and increase your visibility.</p></div>
          <div className="mt-8 grid gap-4 md:grid-cols-2">{plans.isLoading ? <div className="h-80 animate-pulse rounded-md bg-[#e9e1d6] md:col-span-3" /> : (plans.data ?? []).map((plan) => <article className={`relative rounded-md border bg-[#fbf8f2] p-5 ${plan.popular ? 'border-primary shadow-lg' : 'border-[#ddd0c3]'}`} key={plan.id} data-testid={`home-plan-${plan.id}`}>{plan.popular && <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-primary px-3 py-1 text-[9px] font-bold uppercase tracking-[.14em] text-white">Most popular</span>}<p className="text-[10px] font-bold uppercase tracking-[.16em] text-[#a12c63]">{plan.name}</p><p className="mt-3 font-editorial text-4xl text-[#292323]">₹{plan.price}</p><p className="mt-1 text-xs text-[#6e625b]">/ {plan.duration}</p><ul className="mt-5 grid min-h-[104px] gap-2 border-t border-[#e4d9ce] pt-4 text-xs text-[#6e625b]">{plan.features.slice(0, 5).map((feature) => <li className="flex items-start gap-2" key={feature}><Check size={13} className="mt-0.5 shrink-0 text-[#a12c63]" />{feature}</li>)}</ul><Link href="/premium" className={`mt-5 flex w-full items-center justify-center rounded-md px-4 py-3 text-[10px] font-bold uppercase tracking-[.12em] ${plan.popular ? 'bg-primary text-white' : 'border border-[#c9b9ab] text-[#6e2a48]'}`} data-testid={`home-plan-cta-${plan.id}`}>{plan.cta}</Link></article>)}</div>
        </div>
      </section>
      <section id="popular-cities" className="bg-[#111012]">
        <div className="mx-auto max-w-[1320px] px-5 py-10 sm:px-8 lg:px-12"><div className="flex items-end justify-between"><div><p className="font-mono-label text-[10px] uppercase tracking-[.2em] text-accent">Explore by location</p><h2 className="mt-2 font-editorial text-3xl text-[#fff8ee]">Find Men in Popular Cities</h2><p className="mt-1 text-xs text-muted-foreground">Discover men for dating and companionship in your city.</p></div><Link href="/men" className="hidden text-[10px] font-bold uppercase tracking-[.14em] text-primary sm:block" data-testid="link-view-all-cities">View all cities →</Link></div><div className="mt-6 flex flex-wrap gap-2">{(cities.data ?? []).map((city) => <Link href={`/men/${city.slug}`} className="rounded-md border border-foreground/15 bg-[#1b191b] px-4 py-2.5 text-xs text-[#f0e5d9] transition hover:border-primary hover:text-primary" key={city.id} data-testid={`link-city-${city.slug}`}>{city.name}</Link>)}</div></div>
      </section>
      <section className="relative overflow-hidden border-t border-foreground/10"><img src="/assets/him-for-you-hero.jpg" alt="" width="1600" height="900" className="absolute inset-0 h-full w-full object-cover object-[70%_center]" /><div className="absolute inset-0 bg-[#151216]/80" /><div className="relative mx-auto flex max-w-[1320px] flex-col items-start justify-between gap-6 px-5 py-12 sm:flex-row sm:items-center sm:px-8 lg:px-12"><div><p className="font-mono-label text-[10px] uppercase tracking-[.2em] text-accent">For men who are ready</p><h2 className="mt-2 font-editorial text-4xl text-[#fff8ee] sm:text-5xl">Are You Ready to Get Discovered?</h2><p className="mt-2 text-sm text-[#f3e8dc]/75">Create your profile and connect with women looking for interesting and compatible men.</p></div><Link href="/join" className="flex shrink-0 items-center gap-2 rounded-md bg-primary px-5 py-3.5 text-[10px] font-bold uppercase tracking-[.14em] text-white" data-testid="link-register-member">Register as a Member <ArrowUpRight size={14} /></Link></div></section>
    </div>
  );
}

function Browse({ forcedCity }: { forcedCity?: string }) {
  const [city, setCity] = useState(forcedCity ?? '');
  const [intent, setIntent] = useState('');
  const [verified, setVerified] = useState(false);
  const [active, setActive] = useState(false);
  const [sort, setSort] = useState<ListProfilesParams['sort']>('featured');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [savedSearch, setSavedSearch] = useState(false);
  const searchOptions = useDiscoveryOptions();
  const cities = useListCities({ query: { queryKey: getListCitiesQueryKey(), refetchInterval: 30000 } });
  const params = useMemo<ListProfilesParams>(() => ({ ...(city ? { city } : {}), ...(intent ? { lookingFor: intent } : {}), ...(verified ? { verified: true } : {}), ...(active ? { active: true } : {}), sort }), [city, intent, verified, active, sort]);
  const profiles = useListProfiles(params, { query: { queryKey: getListProfilesQueryKey(params) } });
  const cityName = cities.data?.find((item) => item.slug === forcedCity)?.name;

  return (
    <div className="mx-auto max-w-[1320px] px-5 py-12 sm:px-8 lg:px-12 lg:py-16">
      <div className="reveal flex flex-col justify-between gap-8 border-b border-foreground/10 pb-10 lg:flex-row lg:items-end">
        <div><p className="flex items-center gap-3 font-mono-label text-[10px] uppercase tracking-[.22em] text-accent"><span className="h-px w-8 bg-accent" />{cityName ? `Men in ${cityName}` : 'The directory'}</p><h1 className="mt-4 font-editorial text-6xl tracking-[-.06em] sm:text-7xl">{cityName ? `A closer look at ${cityName}.` : 'Find your kind of him.'}</h1><p className="mt-4 max-w-xl text-sm leading-6 text-muted-foreground">Take your time. Filter by what matters, then follow the thread.</p></div>
        <button className="flex w-fit items-center gap-2 rounded-full border border-foreground/20 px-5 py-3 text-xs font-semibold uppercase tracking-[.15em] text-foreground transition hover:border-accent hover:text-accent" onClick={() => setSavedSearch(!savedSearch)} data-testid="button-save-search"><Bookmark size={15} fill={savedSearch ? 'currentColor' : 'none'} /> {savedSearch ? 'Search saved' : 'Save this search'}</button>
      </div>
      <div className="mt-7">
        <button className="flex items-center gap-2 text-xs font-bold uppercase tracking-[.16em] text-accent lg:hidden" onClick={() => setFiltersOpen(!filtersOpen)} data-testid="button-toggle-filters"><SlidersHorizontal size={15} /> {filtersOpen ? 'Hide filters' : 'Show filters'}</button>
        <div className={`${filtersOpen ? 'grid' : 'hidden'} mt-5 gap-3 lg:grid lg:grid-cols-[1.2fr_1.2fr_1fr_1fr_auto]`}>
          <FilterSelect label="City" value={city} onChange={setCity} options={cities.data ?? []} placeholder="Everywhere" testId="select-filter-city" />
          <FilterSelect label="Looking for" value={intent} onChange={setIntent} options={(searchOptions.data?.lookingFor ?? []).map((name) => ({ id: name, slug: name, name, profileCount: 0 }))} placeholder="Any intention" testId="select-filter-intent" />
          <label className="flex h-12 cursor-pointer items-center gap-3 rounded-xl border border-foreground/15 bg-card px-4 text-xs text-muted-foreground"><input type="checkbox" checked={verified} onChange={(event) => setVerified(event.target.checked)} className="accent-[hsl(var(--primary))]" data-testid="checkbox-verified" /> Verified only</label>
          <label className="flex h-12 cursor-pointer items-center gap-3 rounded-xl border border-foreground/15 bg-card px-4 text-xs text-muted-foreground"><input type="checkbox" checked={active} onChange={(event) => setActive(event.target.checked)} className="accent-[hsl(var(--primary))]" data-testid="checkbox-active" /> Available now</label>
          <select className="h-12 rounded-xl border border-foreground/15 bg-card px-4 text-xs text-foreground outline-none focus:border-accent" value={sort} onChange={(event) => setSort(event.target.value as ListProfilesParams['sort'])} data-testid="select-sort"><option value="featured">Sort: Featured</option><option value="active">Sort: Active</option><option value="newest">Sort: Newest</option><option value="age">Sort: Age</option></select>
        </div>
      </div>
      <div className="mt-10 flex items-center justify-between"><p className="text-xs uppercase tracking-[.16em] text-muted-foreground" data-testid="text-result-count">{profiles.data?.length ?? '—'} profiles to explore</p><div className="hidden items-center gap-2 text-xs text-muted-foreground sm:flex"><Search size={14} /> Take the scenic route</div></div>
      <div className="mt-5">{profiles.isLoading ? <ProfileSkeleton count={6} /> : profiles.isError ? <ErrorState onRetry={() => profiles.refetch()} /> : (profiles.data ?? []).length === 0 ? <EmptyBrowse clear={() => { setCity(''); setIntent(''); setVerified(false); setActive(false); }} /> : <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{profiles.data?.map((profile) => <ProfileCard key={profile.id} profile={profile} />)}</div>}</div>
    </div>
  );
}

type FilterOption = { id: number | string; slug: string; name: string; profileCount?: number };

function FilterSelect({ label, value, onChange, options, placeholder, testId }: { label: string; value: string; onChange: (value: string) => void; options: FilterOption[]; placeholder: string; testId: string }) {
  return <div className="relative"><label className="sr-only">{label}</label><select className="h-12 w-full appearance-none rounded-xl border border-foreground/15 bg-card px-4 pr-10 text-sm text-foreground outline-none focus:border-accent" value={value} onChange={(event) => onChange(event.target.value)} data-testid={testId}><option value="">{placeholder}</option>{options.map((option) => <option key={option.id} value={option.slug}>{option.name}{option.profileCount ? ` · ${option.profileCount}` : ''}</option>)}</select><ChevronDown size={15} className="pointer-events-none absolute right-4 top-4 text-muted-foreground" /></div>;
}

function EmptyBrowse({ clear }: { clear: () => void }) {
  return <div className="rounded-2xl border border-dashed border-accent/30 bg-card/40 px-6 py-20 text-center" data-testid="empty-profiles"><Sparkles size={22} className="mx-auto text-accent" /><h2 className="mt-5 font-editorial text-3xl">A quiet corner, for now.</h2><p className="mx-auto mt-3 max-w-sm text-sm leading-6 text-muted-foreground">Try widening your search. The right introduction may be one filter away.</p><button className="mt-6 rounded-full border border-foreground/20 px-5 py-2.5 text-xs font-semibold uppercase tracking-[.15em] hover:border-accent hover:text-accent" onClick={clear} data-testid="button-clear-filters">Clear filters</button></div>;
}

function ProfileDetailPage() {
  const viewer = useViewer();
  useEffect(() => { if (viewer.data) { setContactType(viewer.data.contactType); setContact(viewer.data.contact); } }, [viewer.data]);
  const { slug = '' } = useParams<{ slug: string }>();
  const [note, setNote] = useState('');
  const [contactType, setContactType] = useState<'telegram' | 'whatsapp'>('telegram');
  const [contact, setContact] = useState('');
  const [contactError, setContactError] = useState('');
  const [sent, setSent] = useState(false);
  const [saved, setSaved] = useState(false);
  const queryClient = useQueryClient();
  const profile = useGetProfile(slug, { query: { queryKey: getGetProfileQueryKey(slug) } });
  const interest = useSendInterest();
  const favorite = useToggleFavorite();
  const data = profile.data as ProfileDetail | undefined;
  const submitInterest = () => {
    if (!data || !viewer.data) return;
    if (interest.isPending) return;
    const normalized = contactType === 'telegram' ? contact.trim().replace(/^@/, '') : contact.trim().replace(/[\s()-]/g, '');
    const valid = contactType === 'telegram' ? /^[a-zA-Z][a-zA-Z0-9_]{4,31}$/.test(normalized) : /^\+[1-9]\d{7,14}$/.test(normalized);
    if (!valid) {
      setContactError(contactType === 'telegram' ? 'Enter your Telegram username (5?32 letters, numbers or underscores, starting with a letter).' : 'Enter your WhatsApp number with country code, for example +919876543210.');
      return;
    }
    setContactError('');
    interest.mutate({ id: data.id, data: { note: note.trim() || undefined, contactType, contact: normalized } }, { onSuccess: () => { setSent(true); queryClient.invalidateQueries({ queryKey: ['account-interests'] }); queryClient.invalidateQueries({ queryKey: getGetProfileQueryKey(slug) }); } });
  };
  const toggleFavorite = () => {
    if (!data || !viewer.data) return;
    favorite.mutate({ id: data.id }, { onSuccess: (result) => { setSaved(result.isFavourite ?? !saved); queryClient.invalidateQueries({ queryKey: getGetProfileQueryKey(slug) }); queryClient.invalidateQueries({ queryKey: getListProfilesQueryKey() }); } });
  };
  if (profile.isLoading) return <div className="mx-auto max-w-[1320px] px-5 py-14 sm:px-8 lg:px-12"><div className="grid animate-pulse gap-8 lg:grid-cols-[1fr_1fr]"><div className="h-[570px] rounded-2xl bg-muted" /><div className="space-y-6 pt-10"><div className="h-8 w-2/3 rounded bg-muted" /><div className="h-20 w-full rounded bg-muted" /></div></div></div>;
  if (profile.isError || !data) return <div className="mx-auto max-w-xl px-5 py-24"><ErrorState onRetry={() => profile.refetch()} label="This profile is taking a private moment." /></div>;
  return (
    <div className="mx-auto max-w-[1320px] px-5 py-8 sm:px-8 lg:px-12 lg:py-14">
      <Link href="/men" className="mb-8 inline-flex items-center gap-2 text-xs uppercase tracking-[.16em] text-muted-foreground transition hover:text-accent" data-testid="link-back-browse"><ChevronRight size={14} className="rotate-180" /> Back to discovery</Link>
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,.9fr)] lg:gap-16">
        <div className="relative overflow-hidden rounded-2xl border hairline bg-card">
          <div className="aspect-[4/5] max-h-[700px] bg-muted">
            {photoFor(data) ? <img src={photoFor(data)} alt={`${data.displayName} portrait`} className={`${viewer.data ? "photos-unlocked" : ""} public-men-photo h-full w-full object-cover`} data-testid="img-profile-detail" /> : <div className="flex h-full items-center justify-center font-editorial text-8xl text-accent">{initials(data.displayName)}</div>}
          </div>
          <div className="absolute inset-x-0 bottom-0 flex items-end justify-between bg-gradient-to-t from-background/90 via-background/20 to-transparent p-6 pt-28">
            <div><p className="font-mono-label text-[10px] uppercase tracking-[.18em] text-accent">{data.isPremium ? 'Private member' : 'Verified member'}</p><p className="mt-2 flex items-center gap-2 text-sm text-foreground"><span className={`h-2 w-2 rounded-full ${data.isOnline ? 'bg-[#b9d7a7]' : 'bg-muted-foreground'}`} />{data.isOnline ? 'Available for conversation' : `Last active ${data.lastActive}`}</p></div>
            <button className="flex h-11 w-11 items-center justify-center rounded-full border border-foreground/25 bg-background/60 text-foreground backdrop-blur transition hover:border-accent hover:text-accent" onClick={toggleFavorite} disabled={favorite.isPending} aria-label="Save profile" data-testid="button-detail-favorite"><Heart size={18} fill={saved ? 'currentColor' : 'none'} /></button>
          </div>
        </div>
        <div className="py-2 lg:py-12">
          <div className="flex items-center gap-2 text-xs uppercase tracking-[.15em] text-accent"><BadgeCheck size={16} /> Identity verified</div>
          <h1 className="mt-5 font-editorial text-6xl leading-[.9] tracking-[-.06em] sm:text-7xl" data-testid="text-profile-name">{data.displayName}, <span className="text-muted-foreground">{data.age}</span></h1>
          <p className="mt-5 flex items-center gap-2 text-sm text-muted-foreground"><MapPin size={15} className="text-accent" /> {data.city}</p>
          <p className="mt-8 max-w-xl font-editorial text-2xl leading-[1.2] text-foreground" data-testid="text-profile-headline">“{data.headline}”</p>
          <div className="mt-8 border-y hairline py-6"><p className="text-sm leading-7 text-muted-foreground" data-testid="text-profile-bio">{data.bio}</p></div>
          <div className="grid gap-5 border-b hairline py-6 sm:grid-cols-2"><div><p className="flex items-center gap-2 text-[10px] uppercase tracking-[.16em] text-accent"><Clock3 size={13} /> Response time</p><p className="mt-2 text-sm text-foreground">{data.responseTime}</p></div><div><p className="flex items-center gap-2 text-[10px] uppercase tracking-[.16em] text-accent"><Compass size={13} /> Availability</p><p className="mt-2 text-sm text-foreground">{data.availability}</p></div></div>
          <div className="mt-7 flex flex-wrap gap-2">{[...(data.interests ?? []), ...(data.lookingFor ?? [])].slice(0, 8).map((tag) => <span className="rounded-full border border-foreground/15 px-3 py-1.5 text-xs text-muted-foreground" key={tag}>{tag}</span>)}</div>
          <div className="mt-7 rounded-xl border border-accent/35 bg-accent/10 p-5" data-testid="profile-photo-interest-info">
            <p className="flex items-center gap-2 text-sm font-semibold text-accent"><LockKeyhole size={17} /> Want to see his photo and connect?</p>
            <p className="mt-3 text-sm leading-6 text-foreground/85">Approved members can view clear photos and send interest. Our team will follow up using your registered contact details to arrange an introduction.</p>
            <p className="mt-2 text-xs leading-5 text-muted-foreground">Register with your basic details. After admin approval, log in to unlock photos and send interest.</p>
            <a href="#profile-interest" className="mt-4 inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[.12em] text-accent">Send your interest <Send size={14} /></a>
          </div>
          <UnlockNotice />
          {viewer.data && <div id="profile-interest" className="mt-6 scroll-mt-24 rounded-2xl border border-primary/25 bg-primary/8 p-5 sm:p-6">
            {sent ? <div className="flex items-start gap-4" data-testid="status-interest-success"><CheckCircle2 className="mt-0.5 text-accent" size={22} /><div><h2 className="font-editorial text-2xl">A thoughtful first step.</h2><p className="mt-2 text-sm leading-6 text-muted-foreground">Your interest has been sent. Our team will follow up using your registered contact details about an introduction, subject to availability and consent.</p></div></div> : <><p className="font-mono-label text-[10px] uppercase tracking-[.18em] text-accent">Make an introduction</p><h2 className="mt-3 font-editorial text-2xl">Send your interest. Get to know him.</h2><div className="mt-4"><label htmlFor="interest-contact-type" className="block text-xs text-muted-foreground">How can we contact you?</label><select id="interest-contact-type" disabled value={contactType} onChange={(event) => { setContactType(event.target.value as 'telegram' | 'whatsapp'); setContact(''); setContactError(''); }} className="mt-2 w-full rounded-xl border border-foreground/15 bg-background p-3 text-sm text-foreground"><option value="telegram">Telegram</option><option value="whatsapp">WhatsApp</option></select><label htmlFor="interest-contact" className="mt-4 block text-xs text-muted-foreground">{contactType === 'telegram' ? 'Telegram username' : 'WhatsApp number with country code'} <span aria-hidden="true">*</span></label><input id="interest-contact" readOnly type={contactType === 'whatsapp' ? 'tel' : 'text'} autoComplete={contactType === 'whatsapp' ? 'tel' : 'off'} required maxLength={64} value={contact} onChange={(event) => { setContact(event.target.value); setContactError(''); }} placeholder={contactType === 'telegram' ? '@your_username' : '+919876543210'} aria-invalid={!!contactError} aria-describedby="interest-contact-help interest-contact-error" className="mt-2 w-full rounded-xl border border-foreground/15 bg-background/60 p-3 text-sm text-foreground outline-none focus:border-accent" data-testid="input-interest-contact" /><p id="interest-contact-help" className="mt-2 text-xs leading-5 text-muted-foreground">Your message and contact details will be shared privately with our team so we can respond.</p><p id="interest-contact-error" role="alert" className="mt-2 text-xs text-primary">{contactError}</p></div><label htmlFor="interest-note" className="mt-4 block text-xs text-muted-foreground">Message (optional)</label><textarea id="interest-note" value={note} onChange={(event) => setNote(event.target.value)} maxLength={500} placeholder="A note is optional. A little context goes a long way." className="mt-4 min-h-[92px] w-full resize-none rounded-xl border border-foreground/15 bg-background/60 p-4 text-sm leading-6 text-foreground outline-none placeholder:text-muted-foreground focus:border-accent" data-testid="textarea-interest-note" />{interest.isError && <p className="mt-3 text-xs text-primary" data-testid="status-interest-error">That introduction could not be sent. Please try once more.</p>}<div className="mt-3 flex items-center justify-between gap-3"><span className="text-[11px] text-muted-foreground">{note.length}/500</span><button className="flex items-center gap-2 rounded-full bg-primary px-5 py-3 text-xs font-bold uppercase tracking-[.14em] text-foreground transition hover:bg-primary/85 disabled:opacity-50" onClick={submitInterest} disabled={interest.isPending || !viewer.data} data-testid="button-send-interest">{interest.isPending ? 'Sending…' : 'Send interest'} <Send size={14} /></button></div></>}
          </div>}
        </div>
      </div>
      {data.gallery?.length > 0 && <div className="mt-16 border-t border-foreground/10 pt-10"><p className="font-mono-label text-[10px] uppercase tracking-[.2em] text-accent">A little more of his world</p><div className="scroll-row mt-5 flex gap-4 overflow-auto">{data.gallery.map((image, index) => <img src={image} alt={`${data.displayName} gallery ${index + 1}`} className={`public-men-photo h-56 w-44 shrink-0 rounded-xl object-cover sm:h-72 sm:w-56 ${viewer.data ? "photos-unlocked" : ""}`} key={image} data-testid={`img-gallery-${index}`} />)}</div></div>}
    </div>
  );
}

function Premium() {
  const plans = useListPlans({ query: { queryKey: getListPlansQueryKey() } });
  const [selected, setSelected] = useState<number | null>(null);
  return (
    <div className="surface-grid">
      <section className="mx-auto max-w-[1320px] px-5 pb-14 pt-16 sm:px-8 lg:px-12 lg:pb-20 lg:pt-24">
        <div className="max-w-3xl reveal"><p className="flex items-center gap-3 font-mono-label text-[10px] uppercase tracking-[.22em] text-accent"><span className="h-px w-8 bg-accent" />Membership, with meaning</p><h1 className="mt-5 font-editorial text-6xl leading-[.9] tracking-[-.06em] sm:text-8xl">More room<br />for <em className="text-primary">possibility.</em></h1><p className="mt-7 max-w-lg text-sm leading-7 text-muted-foreground">The best conversations do not need to shout. Choose a membership that gives you the space to be intentional.</p></div>
      </section>
      <section className="mx-auto grid max-w-[1320px] gap-5 px-5 pb-24 sm:px-8 md:grid-cols-2 lg:px-12 lg:pb-32">
        {plans.isLoading ? <div className="md:col-span-3 grid gap-5 md:grid-cols-3">{[1, 2, 3].map((item) => <div className="h-[390px] animate-pulse rounded-2xl bg-muted" key={item} />)}</div> : plans.isError ? <div className="md:col-span-3"><ErrorState onRetry={() => plans.refetch()} label="Membership details are momentarily unavailable." /></div> : (plans.data ?? []).length === 0 ? <div className="md:col-span-3 rounded-2xl border hairline p-14 text-center text-muted-foreground" data-testid="empty-plans">Membership options are being prepared.</div> : plans.data?.map((plan, index) => <PlanCard plan={plan} index={index} selected={selected === plan.id} onSelect={() => setSelected(plan.id)} key={plan.id} />)}
      </section>
      <section className="border-t border-foreground/10 bg-card/60"><div className="mx-auto grid max-w-[1320px] gap-10 px-5 py-16 sm:px-8 md:grid-cols-3 lg:px-12 lg:py-20">{[{icon: LockKeyhole, title: 'Discretion, built in', text: 'Your activity is always private and in your control.'}, {icon: MessageCircle, title: 'Conversation first', text: 'Reach out with context, not just a tap.'}, {icon: Gem, title: 'A higher signal', text: 'See who is active, verified, and open to more.'}].map(({ icon: Icon, title, text }) => <div key={title}><Icon size={20} className="text-accent" /><h3 className="mt-4 font-editorial text-2xl">{title}</h3><p className="mt-2 text-sm leading-6 text-muted-foreground">{text}</p></div>)}</div></section>
    </div>
  );
}

function PlanCard({ plan, index, selected, onSelect }: { plan: Plan; index: number; selected: boolean; onSelect: () => void }) {
  return <article className={`relative rounded-2xl border p-6 transition sm:p-7 ${plan.popular ? 'border-primary bg-primary/10 quiet-shadow' : 'hairline bg-card/70'} ${selected ? 'ring-1 ring-accent' : ''}`} data-testid={`card-plan-${plan.id}`}><div className="flex items-start justify-between"><div><p className="font-mono-label text-[10px] uppercase tracking-[.2em] text-accent">0{index + 1}</p><h2 className="mt-5 font-editorial text-3xl">{plan.name}</h2></div>{plan.popular && <span className="rounded-full bg-primary px-3 py-1 text-[10px] font-bold uppercase tracking-[.14em]">Most chosen</span>}</div><p className="mt-4 min-h-12 text-sm leading-6 text-muted-foreground">{plan.description}</p><div className="mt-7 flex items-baseline gap-2"><span className="font-editorial text-5xl">₹{plan.price}</span><span className="text-xs text-muted-foreground">/ {plan.duration}</span></div><div className="my-7 h-px bg-foreground/10" /><ul className="grid gap-3">{plan.features.map((feature) => <li className="flex items-start gap-3 text-sm text-muted-foreground" key={feature}><Check size={15} className="mt-0.5 shrink-0 text-accent" />{feature}</li>)}</ul><Link href="/join" className={`mt-8 flex w-full items-center justify-center gap-2 rounded-full px-5 py-3.5 text-xs font-bold uppercase tracking-[.15em] transition ${plan.popular ? 'bg-primary text-foreground hover:bg-primary/85' : 'border border-foreground/20 text-foreground hover:border-accent hover:text-accent'}`} onClick={onSelect} data-testid={`button-plan-${plan.id}`}>{selected ? 'Selected' : plan.cta} <ArrowUpRight size={15} /></Link></article>;
}

function CityBrowseRoute() {
  const { city } = useParams<{ city: string }>();
  return <Shell><Browse forcedCity={city} /></Shell>;
}

function Router() {
  return (
    // Keep a shared shell (sidebar, navbar) outside the boundary so it
    // survives a page crash.
    <RoutedErrorBoundary>
      <PageMeta />
      <Switch>
        <Route path="/"><Shell><Home /></Shell></Route>
        <Route path="/men"><Shell><div className="mx-auto max-w-7xl px-5"><UnlockNotice /></div><Browse /></Shell></Route>
        <Route path="/men/:city" component={CityBrowseRoute} />
        <Route path="/profile/:slug"><Shell><ProfileDetailPage /></Shell></Route>
        <Route path="/premium"><Shell><Premium /></Shell></Route>
        <Route path="/join"><Shell><Registration /></Shell></Route>
        <Route path="/my-profile"><Shell><MemberArea profile /></Shell></Route>
        <Route path="/complete-profile"><Shell><MemberArea complete /></Shell></Route>
        <Route path="/dashboard"><Shell><MemberArea /></Shell></Route>
        <Route path="/admin"><Shell><RegistrationAdmin /></Shell></Route>
        <Route path="/account/profile"><Shell><WomenPanel profile /></Shell></Route>
        <Route path="/account/interests"><Shell><WomenPanel interests /></Shell></Route>
        <Route path="/account"><Shell><WomenPanel /></Shell></Route>
        <Route path="/member-interests"><Shell><MemberArea interests /></Shell></Route>
        <Route path="/boost-profile"><Shell><MemberArea boost /></Shell></Route>
        <Route path="/unlock"><Shell><ViewerAccess /></Shell></Route>
        <Route path="/login"><Shell><ViewerAccess login /></Shell></Route>
        <Route path="/admin/registration"><Shell><RegistrationAdmin /></Shell></Route>
        <Route path="/terms"><Shell><RegistrationPolicy /></Shell></Route>
        <Route path="/privacy"><Shell><RegistrationPolicy privacy /></Shell></Route>
        <Route component={NotFound} />
      </Switch>
    </RoutedErrorBoundary>
  );
}

function RoutedErrorBoundary({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
