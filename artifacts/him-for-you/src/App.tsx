import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import {
  ArrowUpRight,
  BadgeCheck,
  Bell,
  Bookmark,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  CircleUserRound,
  Clock3,
  Compass,
  Gem,
  Heart,
  HeartHandshake,
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
            <img src={photoFor(profile)} alt={`${profile.displayName} profile`} className="profile-image h-full w-full object-cover" data-testid={`img-profile-${profile.id}`} />
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
            <span className="flex h-8 w-8 items-center justify-center rounded-full border border-accent/70 text-accent"><HeartHandshake size={15} /></span>
            <span className="font-editorial text-[23px] tracking-[-.02em] text-foreground">him <span className="text-primary">for</span> you</span>
          </Link>
          <nav className="hidden items-center gap-9 md:flex" aria-label="Main navigation">
            <Link href="/men" className={`underlined-link text-xs font-semibold uppercase tracking-[.18em] transition ${isBrowse ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'}`} data-testid="link-browse">Discover men</Link>
            <Link href="/premium" className={`underlined-link text-xs font-semibold uppercase tracking-[.18em] transition ${location === '/premium' ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'}`} data-testid="link-premium">Membership</Link>
            <Link href="/join" className={`underlined-link text-xs font-semibold uppercase tracking-[.18em] transition ${location === '/join' ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'}`} data-testid="link-join">For men</Link>
          </nav>
          <div className="hidden items-center gap-5 md:flex">
            <button className="text-muted-foreground transition hover:text-accent" aria-label="Notifications" data-testid="button-notifications"><Bell size={17} /></button>
            <span className="h-5 w-px bg-foreground/15" />
            <Link href="/join" className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[.16em] text-foreground transition hover:text-accent" data-testid="link-sign-in"><CircleUserRound size={17} /> Sign in</Link>
          </div>
          <button className="flex h-10 w-10 items-center justify-center rounded-full border border-foreground/15 text-foreground md:hidden" onClick={() => setOpen(!open)} aria-label="Open navigation" data-testid="button-mobile-menu">{open ? <X size={18} /> : <Menu size={18} />}</button>
        </div>
        {open && (
          <div className="border-t border-foreground/10 bg-card px-5 py-5 md:hidden" data-testid="mobile-navigation">
            <nav className="grid gap-1">
              <Link href="/men" className="flex items-center justify-between border-b hairline py-4 text-sm font-semibold uppercase tracking-[.15em]" onClick={() => setOpen(false)} data-testid="mobile-link-browse">Discover men <ChevronRight size={16} className="text-accent" /></Link>
              <Link href="/premium" className="flex items-center justify-between border-b hairline py-4 text-sm font-semibold uppercase tracking-[.15em]" onClick={() => setOpen(false)} data-testid="mobile-link-premium">Membership <ChevronRight size={16} className="text-accent" /></Link>
              <Link href="/join" className="flex items-center justify-between py-4 text-sm font-semibold uppercase tracking-[.15em]" onClick={() => setOpen(false)} data-testid="mobile-link-join">For men <ChevronRight size={16} className="text-accent" /></Link>
            </nav>
          </div>
        )}
      </header>
      <main>{children}</main>
      <footer className="border-t border-foreground/10 bg-[#0d0d0f]">
        <div className="mx-auto grid max-w-[1320px] gap-10 px-5 py-12 sm:px-8 md:grid-cols-[1.5fr_1fr_1fr] lg:px-12 lg:py-16">
          <div>
            <div className="flex items-center gap-3"><span className="flex h-7 w-7 items-center justify-center rounded-full border border-accent/70 text-accent"><HeartHandshake size={13} /></span><span className="font-editorial text-xl">him <span className="text-primary">for</span> you</span></div>
            <p className="mt-5 max-w-xs text-sm leading-6 text-muted-foreground">A more considered way to meet. Private by design, human at heart.</p>
          </div>
          <div>
            <p className="font-mono-label text-[10px] uppercase tracking-[.2em] text-accent">Explore</p>
            <div className="mt-4 grid gap-3 text-sm text-muted-foreground"><Link href="/men" className="hover:text-foreground" data-testid="footer-link-men">Discover men</Link><Link href="/premium" className="hover:text-foreground" data-testid="footer-link-premium">Membership</Link><Link href="/join" className="hover:text-foreground" data-testid="footer-link-join">Join as a man</Link></div>
          </div>
          <div>
            <p className="font-mono-label text-[10px] uppercase tracking-[.2em] text-accent">The promise</p>
            <div className="mt-4 grid gap-3 text-sm text-muted-foreground"><span>Verified identities</span><span>Quiet, respectful spaces</span><span>Your privacy, always</span></div>
          </div>
        </div>
        <div className="mx-auto flex max-w-[1320px] flex-col gap-2 border-t border-foreground/10 px-5 py-5 text-[10px] uppercase tracking-[.16em] text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-8 lg:px-12"><span>© 2025 Him For You</span><span>Private connections, thoughtfully made.</span></div>
      </footer>
    </div>
  );
}

function Home() {
  const [chosenCity, setChosenCity] = useState('');
  const [, setLocation] = useLocation();
  const summary = useGetDiscoverySummary();
  const featured = useGetFeaturedProfiles({}, { query: { queryKey: getGetFeaturedProfilesQueryKey({}) } });
  const cities = useListCities({ query: { queryKey: getListCitiesQueryKey() } });
  const featuredProfiles = featured.data ?? [];
  return (
    <div>
      <section className="surface-grid relative overflow-hidden border-b border-foreground/10">
        <div className="absolute -right-32 -top-24 h-[500px] w-[500px] rounded-full bg-primary/10 blur-3xl" />
        <div className="relative mx-auto grid max-w-[1320px] gap-12 px-5 pb-20 pt-16 sm:px-8 sm:pt-24 lg:grid-cols-[1fr_420px] lg:items-end lg:px-12 lg:pb-28 lg:pt-28">
          <div className="reveal max-w-3xl">
            <p className="mb-7 flex items-center gap-3 font-mono-label text-[10px] uppercase tracking-[.25em] text-accent"><span className="h-px w-9 bg-accent" />Private discovery, reimagined</p>
            <h1 className="font-editorial text-[clamp(3.6rem,10vw,8.4rem)] leading-[.88] tracking-[-.065em] text-foreground">Meet the kind<br /><em className="text-primary">of company</em><br />you remember.</h1>
            <p className="mt-8 max-w-md text-[15px] leading-7 text-muted-foreground sm:text-base">Browse verified men who value intention, discretion, and the spark that cannot be scheduled.</p>
            <div className="mt-10 flex flex-col gap-3 sm:flex-row">
              <button className="group flex items-center justify-center gap-3 rounded-full bg-primary px-7 py-3.5 text-xs font-bold uppercase tracking-[.15em] text-foreground transition hover:bg-primary/85" onClick={() => setLocation(chosenCity ? `/men/${chosenCity}` : '/men')} data-testid="button-start-discovery">Start discovering <ArrowUpRight size={16} className="transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" /></button>
              <Link href="/premium" className="flex items-center justify-center gap-3 rounded-full border border-foreground/20 px-7 py-3.5 text-xs font-bold uppercase tracking-[.15em] text-foreground transition hover:border-accent hover:text-accent" data-testid="link-home-membership">How membership works <ChevronRight size={15} /></Link>
            </div>
          </div>
          <div className="reveal reveal-2 rounded-2xl border border-foreground/15 bg-card/80 p-5 quiet-shadow backdrop-blur sm:p-6">
            <div className="flex items-center justify-between"><span className="font-mono-label text-[10px] uppercase tracking-[.2em] text-accent">Begin with a place</span><MapPin size={17} className="text-accent" /></div>
            <p className="mt-5 font-editorial text-2xl">Where are you looking?</p>
            <label className="mt-5 block text-xs text-muted-foreground" htmlFor="home-city">Your city</label>
            <div className="relative mt-2">
              <select id="home-city" className="h-12 w-full appearance-none rounded-xl border border-foreground/15 bg-background px-4 pr-10 text-sm text-foreground outline-none transition focus:border-accent" value={chosenCity} onChange={(event) => setChosenCity(event.target.value)} data-testid="select-home-city">
                <option value="">All available cities</option>
                {(cities.data ?? []).map((city) => <option value={city.slug} key={city.id}>{city.name} · {city.profileCount} profiles</option>)}
              </select>
              <ChevronDown className="pointer-events-none absolute right-4 top-4 text-muted-foreground" size={16} />
            </div>
            <div className="mt-5 flex items-center gap-3 text-xs leading-5 text-muted-foreground"><ShieldCheck size={16} className="shrink-0 text-accent" /> Every profile is reviewed before it appears here.</div>
          </div>
        </div>
      </section>
      <section className="mx-auto max-w-[1320px] px-5 py-12 sm:px-8 lg:px-12 lg:py-16">
        <div className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border hairline bg-foreground/10 sm:grid-cols-4">
          {[['profiles', summary.data?.profileCount ?? '—', 'thoughtful profiles'], ['cities', summary.data?.cityCount ?? '—', 'cities to explore'], ['verified', summary.data?.verifiedCount ?? '—', 'verified identities'], ['active', summary.data?.activeNowCount ?? '—', 'here right now']].map(([key, value, label]) => <div className="bg-card px-4 py-6 sm:px-6" key={key} data-testid={`stat-${key}`}><p className="font-editorial text-3xl text-foreground">{value}</p><p className="mt-1 text-[10px] uppercase tracking-[.16em] text-muted-foreground">{label}</p></div>)}
        </div>
      </section>
      <section className="mx-auto max-w-[1320px] px-5 pb-20 sm:px-8 lg:px-12 lg:pb-28">
        <div className="mb-8 flex items-end justify-between gap-5">
          <div><p className="font-mono-label text-[10px] uppercase tracking-[.2em] text-accent">A considered beginning</p><h2 className="mt-3 font-editorial text-4xl tracking-[-.04em] sm:text-5xl">Featured, for you.</h2></div>
          <Link href="/men" className="hidden items-center gap-2 text-xs font-semibold uppercase tracking-[.16em] text-muted-foreground transition hover:text-accent sm:flex" data-testid="link-view-all">View all men <ArrowUpRight size={15} /></Link>
        </div>
        {featured.isLoading ? <ProfileSkeleton /> : featured.isError ? <ErrorState onRetry={() => featured.refetch()} /> : featuredProfiles.length === 0 ? <div className="rounded-2xl border hairline p-12 text-center text-muted-foreground" data-testid="empty-featured">New profiles are arriving soon.</div> : <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{featuredProfiles.slice(0, 3).map((profile) => <ProfileCard key={profile.id} profile={profile} featured />)}</div>}
        <Link href="/men" className="mt-6 flex items-center justify-center gap-2 text-xs font-semibold uppercase tracking-[.16em] text-muted-foreground sm:hidden" data-testid="mobile-link-view-all">View all men <ArrowUpRight size={15} /></Link>
      </section>
      <section className="border-y border-foreground/10 bg-card/50">
        <div className="mx-auto grid max-w-[1320px] gap-12 px-5 py-20 sm:px-8 lg:grid-cols-[.75fr_1fr] lg:items-center lg:px-12 lg:py-28">
          <div><p className="font-mono-label text-[10px] uppercase tracking-[.2em] text-accent">The Him For You standard</p><h2 className="mt-4 max-w-lg font-editorial text-5xl leading-[.95] tracking-[-.05em] sm:text-6xl">Because chemistry deserves <em className="text-primary">care.</em></h2></div>
          <div className="grid gap-7 sm:grid-cols-3">
            {[{icon: ShieldCheck, title: 'Verified, not vague', text: 'Every man completes a thoughtful identity review.'}, {icon: LockKeyhole, title: 'Private by default', text: 'Your interest stays yours until you choose otherwise.'}, {icon: Heart, title: 'Intentional energy', text: 'Profiles that say more than a polished photo.'}].map(({ icon: Icon, title, text }, index) => <div key={title} className={`reveal reveal-${index + 1}`}><Icon size={19} className="text-accent" /><h3 className="mt-4 font-editorial text-xl">{title}</h3><p className="mt-2 text-sm leading-6 text-muted-foreground">{text}</p></div>)}
          </div>
        </div>
      </section>
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
  const cities = useListCities({ query: { queryKey: getListCitiesQueryKey() } });
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
          <FilterSelect label="Looking for" value={intent} onChange={setIntent} options={['Conversation', 'Companionship', 'Something lasting', 'A little adventure'].map((name) => ({ id: name, slug: name, name, profileCount: 0 }))} placeholder="Any intention" testId="select-filter-intent" />
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
  const { slug = '' } = useParams<{ slug: string }>();
  const [note, setNote] = useState('');
  const [sent, setSent] = useState(false);
  const [saved, setSaved] = useState(false);
  const queryClient = useQueryClient();
  const profile = useGetProfile(slug, { query: { queryKey: getGetProfileQueryKey(slug) } });
  const interest = useSendInterest();
  const favorite = useToggleFavorite();
  const data = profile.data as ProfileDetail | undefined;
  const submitInterest = () => {
    if (!data) return;
    interest.mutate({ id: data.id, data: { note: note.trim() || undefined } }, { onSuccess: () => { setSent(true); queryClient.invalidateQueries({ queryKey: getGetProfileQueryKey(slug) }); } });
  };
  const toggleFavorite = () => {
    if (!data) return;
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
            {photoFor(data) ? <img src={photoFor(data)} alt={`${data.displayName} portrait`} className="h-full w-full object-cover" data-testid="img-profile-detail" /> : <div className="flex h-full items-center justify-center font-editorial text-8xl text-accent">{initials(data.displayName)}</div>}
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
          <div className="mt-9 rounded-2xl border border-primary/25 bg-primary/8 p-5 sm:p-6">
            {sent ? <div className="flex items-start gap-4" data-testid="status-interest-success"><CheckCircle2 className="mt-0.5 text-accent" size={22} /><div><h2 className="font-editorial text-2xl">A thoughtful first step.</h2><p className="mt-2 text-sm leading-6 text-muted-foreground">Your interest has been sent privately. We will let you know if it is returned.</p></div></div> : <><p className="font-mono-label text-[10px] uppercase tracking-[.18em] text-accent">Make an introduction</p><h2 className="mt-3 font-editorial text-2xl">Say hello, if it feels right.</h2><textarea value={note} onChange={(event) => setNote(event.target.value)} maxLength={500} placeholder="A note is optional. A little context goes a long way." className="mt-4 min-h-[92px] w-full resize-none rounded-xl border border-foreground/15 bg-background/60 p-4 text-sm leading-6 text-foreground outline-none placeholder:text-muted-foreground focus:border-accent" data-testid="textarea-interest-note" />{interest.isError && <p className="mt-3 text-xs text-primary" data-testid="status-interest-error">That introduction could not be sent. Please try once more.</p>}<div className="mt-3 flex items-center justify-between gap-3"><span className="text-[11px] text-muted-foreground">{note.length}/500</span><button className="flex items-center gap-2 rounded-full bg-primary px-5 py-3 text-xs font-bold uppercase tracking-[.14em] text-foreground transition hover:bg-primary/85 disabled:opacity-50" onClick={submitInterest} disabled={interest.isPending} data-testid="button-send-interest">{interest.isPending ? 'Sending…' : 'Send interest'} <Send size={14} /></button></div></>}
          </div>
        </div>
      </div>
      {data.gallery?.length > 0 && <div className="mt-16 border-t border-foreground/10 pt-10"><p className="font-mono-label text-[10px] uppercase tracking-[.2em] text-accent">A little more of his world</p><div className="scroll-row mt-5 flex gap-4 overflow-auto">{data.gallery.map((image, index) => <img src={image} alt={`${data.displayName} gallery ${index + 1}`} className="h-56 w-44 shrink-0 rounded-xl object-cover sm:h-72 sm:w-56" key={image} data-testid={`img-gallery-${index}`} />)}</div></div>}
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
      <section className="mx-auto grid max-w-[1320px] gap-5 px-5 pb-24 sm:px-8 md:grid-cols-3 lg:px-12 lg:pb-32">
        {plans.isLoading ? <div className="md:col-span-3 grid gap-5 md:grid-cols-3">{[1, 2, 3].map((item) => <div className="h-[390px] animate-pulse rounded-2xl bg-muted" key={item} />)}</div> : plans.isError ? <div className="md:col-span-3"><ErrorState onRetry={() => plans.refetch()} label="Membership details are momentarily unavailable." /></div> : (plans.data ?? []).length === 0 ? <div className="md:col-span-3 rounded-2xl border hairline p-14 text-center text-muted-foreground" data-testid="empty-plans">Membership options are being prepared.</div> : plans.data?.map((plan, index) => <PlanCard plan={plan} index={index} selected={selected === plan.id} onSelect={() => setSelected(plan.id)} key={plan.id} />)}
      </section>
      <section className="border-t border-foreground/10 bg-card/60"><div className="mx-auto grid max-w-[1320px] gap-10 px-5 py-16 sm:px-8 md:grid-cols-3 lg:px-12 lg:py-20">{[{icon: LockKeyhole, title: 'Discretion, built in', text: 'Your activity is always private and in your control.'}, {icon: MessageCircle, title: 'Conversation first', text: 'Reach out with context, not just a tap.'}, {icon: Gem, title: 'A higher signal', text: 'See who is active, verified, and open to more.'}].map(({ icon: Icon, title, text }) => <div key={title}><Icon size={20} className="text-accent" /><h3 className="mt-4 font-editorial text-2xl">{title}</h3><p className="mt-2 text-sm leading-6 text-muted-foreground">{text}</p></div>)}</div></section>
    </div>
  );
}

function PlanCard({ plan, index, selected, onSelect }: { plan: Plan; index: number; selected: boolean; onSelect: () => void }) {
  return <article className={`relative rounded-2xl border p-6 transition sm:p-7 ${plan.popular ? 'border-primary bg-primary/10 quiet-shadow' : 'hairline bg-card/70'} ${selected ? 'ring-1 ring-accent' : ''}`} data-testid={`card-plan-${plan.id}`}><div className="flex items-start justify-between"><div><p className="font-mono-label text-[10px] uppercase tracking-[.2em] text-accent">0{index + 1}</p><h2 className="mt-5 font-editorial text-3xl">{plan.name}</h2></div>{plan.popular && <span className="rounded-full bg-primary px-3 py-1 text-[10px] font-bold uppercase tracking-[.14em]">Most chosen</span>}</div><p className="mt-4 min-h-12 text-sm leading-6 text-muted-foreground">{plan.description}</p><div className="mt-7 flex items-baseline gap-2"><span className="font-editorial text-5xl">₹{plan.price}</span><span className="text-xs text-muted-foreground">/ {plan.duration}</span></div><div className="my-7 h-px bg-foreground/10" /><ul className="grid gap-3">{plan.features.map((feature) => <li className="flex items-start gap-3 text-sm text-muted-foreground" key={feature}><Check size={15} className="mt-0.5 shrink-0 text-accent" />{feature}</li>)}</ul><Link href="/join" className={`mt-8 flex w-full items-center justify-center gap-2 rounded-full px-5 py-3.5 text-xs font-bold uppercase tracking-[.15em] transition ${plan.popular ? 'bg-primary text-foreground hover:bg-primary/85' : 'border border-foreground/20 text-foreground hover:border-accent hover:text-accent'}`} onClick={onSelect} data-testid={`button-plan-${plan.id}`}>{selected ? 'Selected' : plan.cta} <ArrowUpRight size={15} /></Link></article>;
}

function Join() {
  const [step, setStep] = useState(1);
  const [name, setName] = useState('');
  const [city, setCity] = useState('');
  const [intention, setIntention] = useState('');
  const cities = useListCities({ query: { queryKey: getListCitiesQueryKey() } });
  const [, setLocation] = useLocation();
  const next = () => { if (step < 2) setStep(step + 1); else setLocation('/premium'); };
  return (
    <div className="surface-grid min-h-[calc(100dvh-72px)]">
      <div className="mx-auto grid max-w-[1320px] gap-12 px-5 py-14 sm:px-8 lg:grid-cols-[.8fr_1fr] lg:items-center lg:gap-24 lg:px-12 lg:py-24">
        <div className="reveal"><p className="flex items-center gap-3 font-mono-label text-[10px] uppercase tracking-[.22em] text-accent"><span className="h-px w-8 bg-accent" />A different kind of membership</p><h1 className="mt-5 font-editorial text-6xl leading-[.9] tracking-[-.06em] sm:text-8xl">Show up<br />as <em className="text-primary">yourself.</em></h1><p className="mt-7 max-w-md text-sm leading-7 text-muted-foreground">Him For You is for men who understand that attention is earned. Tell us a little about yourself, then we will show you the way in.</p><div className="mt-10 grid gap-4 text-sm text-muted-foreground"><div className="flex items-center gap-3"><CheckCircle2 size={17} className="text-accent" /> Be seen for more than a photo</div><div className="flex items-center gap-3"><CheckCircle2 size={17} className="text-accent" /> Meet women who value intention</div><div className="flex items-center gap-3"><CheckCircle2 size={17} className="text-accent" /> Move at a pace that feels right</div></div></div>
        <div className="reveal reveal-2 rounded-2xl border hairline bg-card p-6 quiet-shadow sm:p-9">
          <div className="flex items-center justify-between border-b hairline pb-5"><div><p className="font-mono-label text-[10px] uppercase tracking-[.2em] text-accent">Private entry</p><h2 className="mt-3 font-editorial text-3xl">Start with the basics.</h2></div><span className="font-mono-label text-xs text-muted-foreground">0{step} / 02</span></div>
          {step === 1 ? <div className="mt-7 grid gap-5"><label className="grid gap-2 text-xs uppercase tracking-[.14em] text-muted-foreground" htmlFor="join-name">Your name<input id="join-name" value={name} onChange={(event) => setName(event.target.value)} placeholder="What should we call you?" className="mt-1 h-12 rounded-xl border border-foreground/15 bg-background px-4 text-sm normal-case tracking-normal text-foreground outline-none placeholder:text-muted-foreground focus:border-accent" data-testid="input-join-name" /></label><label className="grid gap-2 text-xs uppercase tracking-[.14em] text-muted-foreground" htmlFor="join-city">Where are you based?<select id="join-city" value={city} onChange={(event) => setCity(event.target.value)} className="mt-1 h-12 rounded-xl border border-foreground/15 bg-background px-4 text-sm normal-case tracking-normal text-foreground outline-none focus:border-accent" data-testid="select-join-city"><option value="">Choose a city</option>{(cities.data ?? []).map((item) => <option value={item.slug} key={item.id}>{item.name}</option>)}</select></label><button className="mt-2 flex h-12 items-center justify-center gap-2 rounded-full bg-primary text-xs font-bold uppercase tracking-[.15em] text-foreground transition hover:bg-primary/85 disabled:opacity-45" onClick={next} disabled={!name.trim() || !city} data-testid="button-join-next">Continue <ArrowUpRight size={15} /></button></div> : <div className="mt-7 grid gap-5"><p className="text-sm leading-6 text-muted-foreground">What brings you here, {name || 'friend'}?</p>{['A meaningful relationship', 'Good company, no pressure', 'Curious to see what unfolds'].map((option) => <button key={option} className={`flex items-center justify-between rounded-xl border p-4 text-left text-sm transition ${intention === option ? 'border-accent bg-accent/10 text-foreground' : 'border-foreground/15 text-muted-foreground hover:border-accent/60'}`} onClick={() => setIntention(option)} data-testid={`button-intention-${option.slice(0, 5).toLowerCase()}`}>{option}<span className={`h-4 w-4 rounded-full border ${intention === option ? 'border-accent bg-accent' : 'border-foreground/30'}`} /></button>)}<button className="mt-2 flex h-12 items-center justify-center gap-2 rounded-full bg-primary text-xs font-bold uppercase tracking-[.15em] text-foreground transition hover:bg-primary/85 disabled:opacity-45" onClick={next} disabled={!intention} data-testid="button-join-membership">See membership <ArrowUpRight size={15} /></button><button className="text-xs text-muted-foreground hover:text-accent" onClick={() => setStep(1)} data-testid="button-join-back">Back</button></div>}
          <p className="mt-7 flex items-center justify-center gap-2 text-[11px] leading-5 text-muted-foreground"><LockKeyhole size={13} className="text-accent" /> Your details stay private.</p>
        </div>
      </div>
    </div>
  );
}

function CityBrowseRoute() {
  const { city } = useParams<{ city: string }>();
  return <Shell><Browse forcedCity={city} /></Shell>;
}

function PageMeta() {
  const [location] = useLocation();
  const meta = useMemo(() => {
    if (location.startsWith('/profile/')) {
      return {
        title: 'Meet someone worth remembering | Him For You',
        description: 'Explore a verified Him For You profile and connect with intention, privacy, and ease.',
      };
    }
    if (location === '/premium') {
      return {
        title: 'Membership for more visibility | Him For You',
        description: 'Thoughtful membership plans for men who want to be discovered by the right people.',
      };
    }
    if (location === '/join') {
      return {
        title: 'Join Him For You | Be discovered with intention',
        description: 'Create a considered profile for women looking for meaningful company and connection.',
      };
    }
    if (location.startsWith('/men')) {
      return {
        title: 'Browse verified men near you | Him For You',
        description: 'Discover verified men by city, intention, and availability on a private discovery platform.',
      };
    }
    return {
      title: 'Him For You | Meet the kind of company you remember',
      description: 'Discover verified men for dating, companionship, travel, dinners, and meaningful private connections.',
    };
  }, [location]);

  useEffect(() => {
    document.title = meta.title;
    const description = document.querySelector('meta[name="description"]');
    description?.setAttribute('content', meta.description);
    const ogTitle = document.querySelector('meta[property="og:title"]');
    ogTitle?.setAttribute('content', meta.title);
    const ogDescription = document.querySelector('meta[property="og:description"]');
    ogDescription?.setAttribute('content', meta.description);
    const canonical = document.querySelector('link[rel="canonical"]');
    canonical?.setAttribute('href', `${window.location.origin}${location}`);
  }, [location, meta]);

  return null;
}

function Router() {
  return (
    // Keep a shared shell (sidebar, navbar) outside the boundary so it
    // survives a page crash.
    <RoutedErrorBoundary>
      <PageMeta />
      <Switch>
        <Route path="/"><Shell><Home /></Shell></Route>
        <Route path="/men"><Shell><Browse /></Shell></Route>
        <Route path="/men/:city" component={CityBrowseRoute} />
        <Route path="/profile/:slug"><Shell><ProfileDetailPage /></Shell></Route>
        <Route path="/premium"><Shell><Premium /></Shell></Route>
        <Route path="/join"><Shell><Join /></Shell></Route>
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
