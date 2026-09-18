import { MembershipGate, PaymentSettings } from "./membership-gate";
import { viewerApi } from "./viewer-access";
import { SeoAdmin } from "./seo";
import { DiscoveryOptionsAdmin } from "./discovery-options";
import { BoostPanel, InterestHistory } from "./account-panels";
import { ViewerQueue } from "./viewer-access";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link } from "wouter";
import { SiTelegram } from "react-icons/si";
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogClose } from "@/components/ui/dialog";
import { useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  Crown,
  LockKeyhole,
  ShieldCheck,
  Upload,
  X,
} from "lucide-react";
import {
  useGetRegistrationSettings,
  useRegisterProfile,
  useUpdateMyRegistration,
  useListAdminRegistrations,
  useReviewRegistration,
  useGetMyRegistration,
  useLoginRegistration,
  useLoginRegistrationAdmin,
  useUpdateRegistrationSettings,
  type RegistrationInput,
  type RegistrationRecord,
  type RegistrationSettings,
} from "@workspace/api-client-react";

const labels = [
  "Basic Details",
  "About You",
  "Location",
  "Photos",
  "Preferences",
  "Listing Plan",
  "Review",
];
const headings = [
  "Tell Us About Yourself",
  "Create Your Profile Introduction",
  "Where Are You Available?",
  "Show Your Best Side",
  "Tell People What You’re Looking For",
  "Choose How You Want to Join",
  "Almost Done! Review Your Profile",
];
const subtitles = [
  "Let’s start with some basic information to create your profile.",
  "Tell visitors a little about yourself. A genuine and well-written profile can help you create a more engaging profile.",
  "Your location helps people discover profiles in their preferred city or area.",
  "Profiles with clear and genuine photos can create a better first impression.",
  "This helps visitors understand your interests and preferences.",
  "Your profile submission is required for all registration options. Choose the listing option that works best for you.",
  "Take a moment to check your details. You can edit any section before submitting.",
];
const interests = [
  "Dating & Companionship",
  "Friendship",
  "Social Meetups",
  "Travel Partner",
  "Dinner & Events",
  "Fitness & Activities",
  "Movies & Entertainment",
  "Conversations",
  "Other Interests",
];
const languages = [
  "English",
  "Hindi",
  "Tamil",
  "Telugu",
  "Kannada",
  "Malayalam",
  "Marathi",
  "Bengali",
  "Gujarati",
  "Punjabi",
  "Urdu",
  "Other",
];
const preferences = [
  "Friendship",
  "Dating",
  "Companionship",
  "Social Activities",
  "Travel Partner",
  "Events & Entertainment",
  "Casual Meetups",
];
const inputClass =
  "w-full rounded-xl border border-foreground/15 bg-background px-4 py-3 text-sm text-foreground outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/15";
const primary =
  "inline-flex items-center justify-center gap-2 rounded-full bg-primary px-6 py-3.5 text-sm font-semibold text-white transition hover:bg-primary/85 disabled:opacity-50";
const secondary =
  "inline-flex items-center justify-center gap-2 rounded-full border border-foreground/20 px-5 py-3 text-sm hover:border-accent";
const initial: RegistrationInput = {
  displayName: "",
  age: 18,
  dateOfBirth: "",
  email: "",
  mobile: "",
  password: "",
  confirmPassword: "",
  headline: "",
  about: "",
  interests: [],
  languages: [],
  country: "India",
  state: "",
  city: "",
  area: "",
  pinCode: "",
  photos: [],
  mainPhoto: 0,
  preferences: [],
  minAge: 18,
  maxAge: 60,
  availability: [],
  status: "available",
  listing: "free",
  partnerOptIn: false,
  accurate: false,
  terms: false,
  adult: false,
};
function Field({
  label,
  children,
  error,
}: {
  label: string;
  children: ReactNode;
  error?: string;
}) {
  return (
    <label className="grid content-start gap-2 text-sm">
      <span>{label}</span>
      {children}
      {error && (
        <span role="alert" className="text-xs text-primary">
          {error}
        </span>
      )}
    </label>
  );
}
function Notice({ children }: { children: ReactNode }) {
  return (
    <div className="flex gap-3 rounded-xl border border-accent/20 bg-accent/5 p-4 text-xs leading-6 text-muted-foreground">
      <ShieldCheck size={18} className="mt-1 shrink-0 text-accent" />
      <div>{children}</div>
    </div>
  );
}
function Choices({
  title,
  options,
  selected,
  onChange,
}: {
  title: string;
  options: string[];
  selected: string[];
  onChange: (values: string[]) => void;
}) {
  return (
    <fieldset>
      <legend className="mb-3 text-sm">{title}</legend>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => (
          <button
            key={option}
            type="button"
            aria-pressed={selected.includes(option)}
            onClick={() =>
              onChange(
                selected.includes(option)
                  ? selected.filter((x) => x !== option)
                  : [...selected, option],
              )
            }
            className={`rounded-xl border px-4 py-2.5 text-sm transition ${selected.includes(option) ? "border-primary bg-primary/15 text-foreground" : "border-foreground/15 text-muted-foreground hover:border-accent"}`}
          >
            {selected.includes(option) && (
              <Check size={13} className="mr-2 inline" />
            )}
            {option}
          </button>
        ))}
      </div>
    </fieldset>
  );
}
function ageFromDate(value: string) {
  const date = new Date(`${value}T00:00:00Z`);
  const now = new Date();
  let age = now.getUTCFullYear() - date.getUTCFullYear();
  if (
    now.getUTCMonth() < date.getUTCMonth() ||
    (now.getUTCMonth() === date.getUTCMonth() &&
      now.getUTCDate() < date.getUTCDate())
  )
    age--;
  return age;
}
async function readPhoto(file: File): Promise<string> {
  if (
    !["image/jpeg", "image/png", "image/webp"].includes(file.type) ||
    file.size > 5 * 1024 * 1024
  )
    throw new Error("Choose a JPEG, PNG or WebP photo smaller than 5 MB.");
  const bitmap = await createImageBitmap(file);
  try {
    const scale = Math.min(1, 1400 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const context = canvas.getContext("2d");
    if (!context)
      throw new Error(
        "Photo preview is unavailable. Please try another browser.",
      );
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const result = canvas.toDataURL("image/jpeg", 0.8);
    if (result.length > 1500000)
      throw new Error("Please choose a smaller photo.");
    return result;
  } finally {
    bitmap.close();
  }
}
function errorMessage(error: unknown) {
  const value = error as { data?: { message?: string }; message?: string };
  return (
    value?.data?.message ||
    "We could not complete this request. Please try again."
  );
}
export function RegistrationSummary({
  data,
  edit,
}: {
  data: RegistrationInput | RegistrationRecord;
  edit?: (step: number) => void;
}) {
  const sections = [
    {
      title: "Basic Details",
      content: (
        <>
          <p className="text-lg font-medium">
            {data.displayName}, {data.age}
          </p>
          <p className="text-xs text-muted-foreground">
            Personal contact details stay private.
          </p>
        </>
      ),
    },
    {
      title: "About You",
      content: (
        <>
          <p className="font-editorial text-2xl">
            {data.headline || "Add your introduction later"}
          </p>
          <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-muted-foreground">
            {data.about}
          </p>
          <p className="mt-3 text-sm">{data.interests.join(" · ")}</p>
          <p className="mt-2 text-xs text-muted-foreground">
            Languages: {data.languages.join(", ") || "Add later"}
          </p>
        </>
      ),
    },
    {
      title: "Location",
      content: (
        <p>
          {[data.area, data.city, data.state, data.country]
            .filter(Boolean)
            .join(", ") || "Add your location later"}
        </p>
      ),
    },
    {
      title: "Photos",
      content: (
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
          {!data.photos.length && (
            <p className="col-span-full text-sm text-muted-foreground">
              No photos added yet. You can upload them later.
            </p>
          )}
          {data.photos.map((photo, index) => (
            <div key={index}>
              <img
                src={photo.dataUrl}
                alt={`${data.displayName}, photo ${index + 1}`}
                className="aspect-[3/4] w-full rounded-xl object-cover"
              />
              {index === data.mainPhoto && (
                <p className="mt-2 text-xs text-accent">Main photo</p>
              )}
            </div>
          ))}
        </div>
      ),
    },
    {
      title: "Preferences",
      content: (
        <div className="space-y-2 text-sm">
          <p>{data.preferences.join(" · ")}</p>
          <p>
            Ages {data.minAge}–{data.maxAge} ·{" "}
            {data.status === "available"
              ? "Available"
              : "Temporarily Unavailable"}
          </p>
          <p className="text-muted-foreground">
            {data.availability.join(", ")}
          </p>
        </div>
      ),
    },
    {
      title: "Listing Plan",
      content: (
        <>
          <p className="capitalize">
            {data.listing === "free"
              ? "Choose a membership plan"
              : `${data.listing === 'quarterly' ? 'Quarterly' : 'Annual'} Membership`}
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            {data.partnerOptIn
              ? "Interested in optional partner platform information."
              : "Partner platform information: not selected."}
          </p>
        </>
      ),
    },
  ];
  return (
    <div className="grid gap-4">
      {sections.map((section, index) => (
        <section
          className="rounded-2xl border border-foreground/10 bg-background/40 p-5"
          key={section.title}
        >
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-xs uppercase tracking-widest text-accent">
              {section.title}
            </h3>
            {edit && (
              <button
                type="button"
                className="text-xs underline underline-offset-4"
                onClick={() => edit(index)}
              >
                Edit<span className="sr-only"> {section.title}</span>
              </button>
            )}
          </div>
          {section.content}
        </section>
      ))}
    </div>
  );
}
export default function Registration({
  existing,
}: {
  existing?: RegistrationRecord;
}) {
  const queryClient = useQueryClient();
  const [step, setStep] = useState(existing ? 1 : 0);
  const [data, setData] = useState<RegistrationInput>(
    existing
      ? {
          ...existing,
          age: ageFromDate(existing.dateOfBirth),
          password: "",
          confirmPassword: "",
        }
      : initial,
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [uploading, setUploading] = useState(false);
  const [submitted, setSubmitted] = useState<RegistrationRecord>();
  const top = useRef<HTMLHeadingElement>(null);
  const settings = useGetRegistrationSettings();
  const registerNew = useRegisterProfile();
  const update = useUpdateMyRegistration();
  const register = existing ? update : registerNew;
  const patch = <K extends keyof RegistrationInput>(
    key: K,
    value: RegistrationInput[K],
  ) => {
    setData((current) => ({
      ...current,
      [key]: value,
      ...(key === "dateOfBirth" ? { age: ageFromDate(String(value)) } : {}),
    }));
    setErrors((current) => ({ ...current, [key]: "" }));
  };
  const go = (value: number) => {
    setStep(value);
    setErrors({});
    requestAnimationFrame(() => {
      top.current?.focus();
      top.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  };
  const validate = (value: number) => {
    const next: Record<string, string> = {};
    const required = (keys: (keyof RegistrationInput)[]) =>
      keys.forEach((key) => {
        if (!String(data[key]).trim())
          next[key] = "Please complete this field.";
      });
    if (value === 0) {
      required([
        "displayName",
        "dateOfBirth",
        "email",
        "mobile",
        ...(!existing ? (["password", "confirmPassword"] as const) : []),
      ]);
      const age = ageFromDate(data.dateOfBirth);
      if (!data.dateOfBirth || !Number.isInteger(age) || age < 18 || age > 100)
        next.dateOfBirth =
          "Enter a valid date of birth. You must be between 18 and 100 years old to register.";
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email))
        next.email = "Enter a valid email address.";
      if (!/^\+[1-9]\d{7,14}$/.test(data.mobile.replace(/[\s()-]/g, "")))
        next.mobile = "Include your country code, for example +919876543210.";
      if (!existing && data.password.length < 8)
        next.password = "Use at least 8 characters.";
      if (!existing && data.password !== data.confirmPassword)
        next.confirmPassword = "Passwords do not match.";
    }
    if (existing && value === 1) {
      required(["headline", "about"]);
      if (!data.interests.length || !data.languages.length)
        next.selections = "Select at least one interest and one language.";
    }
    if (existing && value === 2) required(["country", "state", "city", "area"]);
    if (existing && value === 3 && !data.photos.length)
      next.photos = "Add at least one profile photo before publishing.";
    if (
      existing &&
      value === 4 &&
      (!data.preferences.length || !data.availability.length)
    )
      next.selections = "Select your preferences and availability.";
    if (value === 3 && data.photos.length > 0 && !data.photos[data.mainPhoto])
      next.photos = "Choose a main profile photo.";
    if (value === 4) {
      if (
        !Number.isInteger(data.minAge) ||
        !Number.isInteger(data.maxAge) ||
        data.minAge < 18 ||
        data.maxAge > 100 ||
        data.minAge > data.maxAge
      )
        next.minAge =
          "Enter an age range between 18 and 100, with minimum no higher than maximum.";
    }
    if (
      value === 5 &&
      !settings.data?.plans.find((p) => p.id === data.listing)?.enabled
    )
      next.listing =
        "Choose Quarterly or Annual to continue.";
    if (value === 6 && (!data.accurate || !data.terms || !data.adult))
      next.confirmations = "Please check all three required confirmations.";
    return next;
  };
  const next = () => {
    const issues = validate(step);
    if (Object.keys(issues).length) {
      setErrors(issues);
      return;
    }
    if (!existing) { submit(); return; }
    go(step + 1);
  };
  const submit = () => {
    if (register.isPending) return;
    for (let i = 0; i < (existing ? 7 : 1); i++) {
      const issues = validate(i);
      if (Object.keys(issues).length) {
        go(i);
        setErrors(issues);
        return;
      }
    }
    if (!existing && (!data.terms || !data.adult || !data.accurate)) { setErrors({confirmations: "Please accept the required confirmation."}); return; }
    register.mutate(
      {
        data: {
          ...data,
          id: existing?.id || "",
          submittedAt: existing?.submittedAt || "",
          reviewStatus: existing?.reviewStatus || "Submitted",
          listingPrice: existing?.listingPrice || 0,
        },
      },
      {
        onSuccess: (result) => {
          if (existing)
            queryClient.setQueryData(["/api/registration/me"], result);
          else
            queryClient.removeQueries({ queryKey: ["/api/registration/me"] });
          setSubmitted(result);
          setData(initial);
          window.scrollTo({ top: 0, behavior: "smooth" });
        },
        onError: (error) => {
          const field = (error as { data?: { field?: string } }).data?.field;
          const fieldsByStep = [
            [
              "displayName",
              "age",
              "dateOfBirth",
              "email",
              "mobile",
              "password",
              "confirmPassword",
            ],
            ["headline", "about", "interests", "languages"],
            ["country", "state", "city", "area", "pinCode"],
            ["photos", "mainPhoto"],
            ["preferences", "availability", "minAge", "maxAge", "status"],
            ["listing"],
            ["confirmations"],
          ];
          const target = fieldsByStep.findIndex((fields) =>
            fields.includes(field || ""),
          );
          if (field && target >= 0) {
            go(target);
            setErrors({ [field]: errorMessage(error) });
          }
        },
      },
    );
  };
  const field = (
    key: keyof RegistrationInput,
    label: string,
    type = "text",
    placeholder?: string,
    maxLength = 120,
  ) => (
    <Field label={label} error={errors[key]}>
      <span className="relative block">
      <input
        className={`${inputClass}${key === "mobile" ? " pr-12" : ""}`}
        type={type}
        value={String(data[key])}
        placeholder={placeholder}
        maxLength={maxLength}
        required={step === 0}
        min={type === "number" ? 18 : undefined}
        max={type === "number" ? 100 : undefined}
        autoComplete={type === "password" ? "new-password" : undefined}
        aria-invalid={!!errors[key]}
        aria-describedby={key === "mobile" ? "telegram-mobile-help" : undefined}
        onChange={(e) =>
          patch(
            key,
            type === "number" ? Number(e.target.value) : e.target.value,
          )
        }
      />
      {key === "mobile" && <SiTelegram aria-hidden="true" className="pointer-events-none absolute right-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#2AABEE]" />}
      </span>
    </Field>
  );
  const upload = async (
    files: FileList | null,
    category: "profile" | "additional" | "gallery",
    replace?: number,
  ) => {
    if (!files?.length) return;
    if (replace === undefined && data.photos.length + files.length > 8) {
      setErrors({ photos: "You can add up to 8 photos in total." });
      return;
    }
    setUploading(true);
    setErrors({});
    try {
      const photos = await Promise.all(
        Array.from(files).map(async (file) => ({
          dataUrl: await readPhoto(file),
          category,
        })),
      );
      setData((current) => ({
        ...current,
        photos:
          replace === undefined
            ? [...current.photos, ...photos]
            : current.photos.map((photo, i) =>
                i === replace ? photos[0] : photo,
              ),
      }));
    } catch (error) {
      setErrors({
        photos:
          error instanceof Error
            ? error.message
            : "This photo could not be read. Try another image.",
      });
    } finally {
      setUploading(false);
    }
  };
  if (submitted)
    return (
      <div className="mx-auto max-w-2xl px-5 py-20 text-center">
        <CheckCircle2 size={58} className="mx-auto text-accent" />
        <p className="mt-6 text-xs uppercase tracking-widest text-accent">
          Rent a Man · Registration complete
        </p>
        <h1 className="mt-4 font-editorial text-4xl sm:text-5xl">
          {existing
            ? "Your Profile Has Been Updated!"
            : "Thank You! Your Account Is Registered."}
        </h1>
        <p className="mt-6 text-sm leading-7 text-muted-foreground">
          {existing
            ? "Your profile has been submitted for admin review. Your card will appear after approval. You can still use your dashboard."
            : "Thank you! Your account registration is complete and is now under review. Once admin approves, you can log in and upgrade to complete your profile."}
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          {existing && (
            <Link href="/my-profile" className={primary}>
              View My Profile <ArrowRight size={16} />
            </Link>
          )}
          <Link href="/dashboard" className={secondary}>
            {existing ? "Go to Dashboard" : "Log in after approval"}
          </Link>
        </div>
      </div>
    );
  return (
    <div className="surface-grid min-h-screen">
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-8 sm:py-14">
        <div className="mb-8 flex items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[.25em] text-accent">
              Rent a Man
            </p>
            <h1 className="mt-2 font-editorial text-3xl sm:text-4xl">
              A great connection starts with you.
            </h1>
          </div>
          <LockKeyhole className="hidden text-accent sm:block" size={28} />
        </div>
        {existing && <div className="mb-8 rounded-2xl border border-foreground/10 bg-card p-4 sm:p-6">
          <div className="mb-4 flex justify-between text-xs">
            <span>
              Step {step + 1} of 7 · {labels[step]}
            </span>
            <span className="text-accent">
              {Math.round(((step + 1) / 7) * 100)}%
            </span>
          </div>
          <div
            role="progressbar"
            aria-label="Registration progress"
            aria-valuemin={1}
            aria-valuemax={7}
            aria-valuenow={step + 1}
            className="h-1.5 overflow-hidden rounded-full bg-foreground/10"
          >
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{ width: `${((step + 1) / 7) * 100}%` }}
            />
          </div>
          <ol className="mt-5 hidden grid-cols-7 gap-2 sm:grid">
            {labels.map((label, i) => (
              <li
                key={label}
                aria-current={i === step ? "step" : undefined}
                className={`text-center text-[10px] ${i === step ? "text-accent" : "text-muted-foreground"}`}
              >
                <span
                  className={`mx-auto mb-2 flex h-7 w-7 items-center justify-center rounded-full border ${i <= step ? "border-primary bg-primary/15" : "border-foreground/15"}`}
                >
                  {i < step ? <Check size={12} /> : i + 1}
                </span>
                {label}
              </li>
            ))}
          </ol>
        </div>}
        <div className="rounded-3xl border border-foreground/10 bg-card p-5 shadow-xl shadow-black/10 sm:p-9">
          <h2
            ref={top}
            tabIndex={-1}
            className="scroll-mt-24 font-editorial text-3xl outline-none sm:text-4xl"
          >
            {headings[step]}
          </h2>
          <p className="mt-3 max-w-2xl text-sm leading-7 text-muted-foreground">
            {subtitles[step]}
          </p>
          <form
            className="mt-8"
            noValidate
            onSubmit={(event) => {
              event.preventDefault();
              if (step === 6) submit();
              else next();
            }}
          >
            <div className="grid gap-6">
              {step === 0 && (
                <>
                  <div className="grid gap-5 sm:grid-cols-2">
                    {field(
                      "displayName",
                      "Display Name",
                      "text",
                      "How should we call you?",
                      80,
                    )}
                    {field("dateOfBirth", "Date of Birth", "date")}
                    {field(
                      "email",
                      "Email Address",
                      "email",
                      "you@example.com",
                      254,
                    )}
                    <div>
                    {field(
                      "mobile",
                      "Mobile Number",
                      "tel",
                      "+919876543210",
                      25,
                    )}
                    </div>
                    <div className="-mt-2 flex flex-wrap items-baseline gap-x-2 gap-y-1 sm:col-span-2">
                    <p id="telegram-mobile-help" className="text-xs leading-5 text-muted-foreground">
                      A Telegram-linked number is required. Please enter the number you use on Telegram.
                    </p>
                    <Dialog>
                      <DialogTrigger asChild>
                        <button type="button" className="mt-1 rounded text-xs text-accent underline underline-offset-4 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">Why Telegram?</button>
                      </DialogTrigger>
                      <DialogContent className="w-[calc(100%-2rem)] rounded-2xl border-foreground/15 bg-card sm:max-w-md">
                        <DialogHeader>
                          <DialogTitle className="pr-5 font-editorial text-2xl">Why Telegram?</DialogTitle>
                          <DialogDescription className="pt-2 leading-6">Telegram makes it easy to stay in touch. Please register with the same mobile number you use on Telegram.</DialogDescription>
                        </DialogHeader>
                        <ul className="space-y-3 text-sm leading-6 text-muted-foreground">
                          <li><strong className="text-foreground">More control over your privacy.</strong> Choose who can see your phone number in Telegram’s privacy settings.</li>
                          <li><strong className="text-foreground">Connect with a username.</strong> Share your Telegram username so others can find you without needing your number.</li>
                          <li><strong className="text-foreground">Stay connected across devices.</strong> Access your cloud chats on your phone, tablet or computer.</li>
                        </ul>
                        <p className="text-xs leading-5 text-muted-foreground">Not on Telegram yet? Set up your account with this mobile number, then return here to register. You can check your linked number in Telegram Settings.</p>
                        <a href="https://telegram.org/faq" target="_blank" rel="noreferrer" className="text-xs text-accent underline underline-offset-4">Explore Telegram features</a>
                        <DialogClose asChild><button type="button" className="rounded-full bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground">Got it</button></DialogClose>
                      </DialogContent>
                    </Dialog>
                    </div>
                    {!existing && (
                      <>
                        {field(
                          "password",
                          "Password",
                          "password",
                          "At least 8 characters",
                          128,
                        )}
                        {field(
                          "confirmPassword",
                          "Confirm Password",
                          "password",
                          "Enter your password again",
                          128,
                        )}
                      </>
                    )}
                  </div>
                  <Notice>
                    Your personal contact information is kept private and will
                    not be publicly displayed unless you choose to share it.
                  </Notice>
                </>
              )}
              {step === 1 && (
                <>
                  {field(
                    "headline",
                    "Profile Headline",
                    "text",
                    "Friendly and confident man looking to meet new people",
                  )}
                  <Field label="About Me" error={errors.about}>
                    <textarea
                      className={`${inputClass} min-h-36`}
                      maxLength={2000}
                      value={data.about}
                      onChange={(e) => patch("about", e.target.value)}
                      placeholder="Introduce yourself, share your personality, interests, hobbies and what makes you unique."
                    />
                    <span className="text-right text-xs text-muted-foreground">
                      {data.about.length}/2000
                    </span>
                  </Field>
                  <Choices
                    title="Interests · select all that apply"
                    options={interests}
                    selected={data.interests}
                    onChange={(v) => patch("interests", v)}
                  />
                  <Choices
                    title="Languages Spoken"
                    options={languages}
                    selected={data.languages}
                    onChange={(v) => patch("languages", v)}
                  />
                </>
              )}
              {step === 2 && (
                <>
                  <div className="grid gap-5 sm:grid-cols-2">
                    {field("country", "Country", "text", "India", 80)}
                    {field("state", "State", "text", "Tamil Nadu", 80)}
                    {field("city", "City", "text", "Coimbatore", 80)}
                    {field(
                      "area",
                      "Area / Locality",
                      "text",
                      "Your preferred locality",
                      100,
                    )}
                    {field(
                      "pinCode",
                      "PIN Code (Optional)",
                      "text",
                      "641001",
                      12,
                    )}
                  </div>
                  <Notice>
                    Your exact home address will never be displayed publicly.
                    Only the location details you choose for your profile will
                    be visible.
                  </Notice>
                </>
              )}
              {step === 3 && (
                <>
                  <div className="grid gap-3 sm:grid-cols-3">
                    {(["profile", "additional", "gallery"] as const).map(
                      (category) => (
                        <label
                          key={category}
                          className={`flex cursor-pointer flex-col items-center rounded-2xl border border-dashed border-accent/35 bg-accent/5 p-6 text-center ${uploading ? "opacity-50" : "hover:bg-accent/10"}`}
                        >
                          <Upload className="mb-3 text-accent" size={24} />
                          <span className="text-sm capitalize">
                            {category === "profile"
                              ? "Profile Photo"
                              : `${category} Photos`}
                          </span>
                          <span className="mt-2 text-xs text-muted-foreground">
                            Choose photos
                          </span>
                          <input
                            aria-label={`Upload ${category} photos`}
                            className="mt-3 w-full text-xs"
                            type="file"
                            accept="image/jpeg,image/png,image/webp"
                            multiple={category !== "profile"}
                            disabled={uploading}
                            onChange={(event) => {
                              void upload(event.target.files, category);
                              event.target.value = "";
                            }}
                          />
                        </label>
                      ),
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    JPEG, PNG or WebP · Up to 5 MB per upload ·{" "}
                    {data.photos.length}/8 photos
                  </p>
                  {uploading && (
                    <p role="status" className="text-sm text-accent">
                      Preparing your photos…
                    </p>
                  )}
                  <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                    {data.photos.map((photo, i) => (
                      <div
                        key={i}
                        className={`relative overflow-hidden rounded-xl border ${data.mainPhoto === i ? "border-accent" : "border-foreground/15"}`}
                      >
                        <img
                          src={photo.dataUrl}
                          alt={`Uploaded photo ${i + 1}`}
                          className="aspect-[3/4] w-full object-cover"
                        />
                        <button
                          type="button"
                          disabled={uploading}
                          onClick={() =>
                            setData((current) => ({
                              ...current,
                              photos: current.photos.filter(
                                (_, index) => index !== i,
                              ),
                              mainPhoto:
                                current.mainPhoto === i
                                  ? 0
                                  : current.mainPhoto > i
                                    ? current.mainPhoto - 1
                                    : current.mainPhoto,
                            }))
                          }
                          aria-label={`Remove photo ${i + 1}`}
                          className="absolute right-2 top-2 rounded-full bg-black/70 p-1.5 text-white"
                        >
                          <X size={14} />
                        </button>
                        <div className="grid gap-2 p-3">
                          <button
                            type="button"
                            className="text-xs text-accent"
                            aria-pressed={data.mainPhoto === i}
                            onClick={() => patch("mainPhoto", i)}
                          >
                            {data.mainPhoto === i
                              ? "✓ Main profile photo"
                              : "Set as main photo"}
                          </button>
                          <label className="cursor-pointer text-center text-xs text-muted-foreground underline">
                            Change
                            <input
                              className="sr-only"
                              type="file"
                              accept="image/jpeg,image/png,image/webp"
                              disabled={uploading}
                              onChange={(event) => {
                                void upload(
                                  event.target.files,
                                  photo.category,
                                  i,
                                );
                                event.target.value = "";
                              }}
                            />
                          </label>
                        </div>
                      </div>
                    ))}
                  </div>
                  <Notice>
                    <strong className="text-foreground">
                      Photo guidelines
                    </strong>
                    <ul className="mt-2 list-disc space-y-1 pl-4">
                      <li>Upload clear and recent photos</li>
                      <li>Use genuine photos that represent you accurately</li>
                      <li>Avoid blurred or excessively edited images</li>
                      <li>Follow platform community guidelines</li>
                    </ul>
                  </Notice>
                </>
              )}
              {step === 4 && (
                <>
                  <Choices
                    title="I’m looking for"
                    options={preferences}
                    selected={data.preferences}
                    onChange={(v) => patch("preferences", v)}
                  />
                  <fieldset>
                    <legend className="mb-3 text-sm">Age Preference</legend>
                    <div className="grid grid-cols-2 gap-4">
                      {field("minAge", "Minimum Age", "number")}
                      {field("maxAge", "Maximum Age", "number")}
                    </div>
                  </fieldset>
                  <Choices
                    title="Availability"
                    options={[
                      "Weekdays",
                      "Weekends",
                      "Morning",
                      "Afternoon",
                      "Evening",
                    ]}
                    selected={data.availability}
                    onChange={(v) => patch("availability", v)}
                  />
                  <Field label="Profile Status">
                    <select
                      className={inputClass}
                      value={data.status}
                      onChange={(e) =>
                        patch(
                          "status",
                          e.target.value as RegistrationInput["status"],
                        )
                      }
                    >
                      <option value="available">Available</option>
                      <option value="unavailable">
                        Temporarily Unavailable
                      </option>
                    </select>
                  </Field>
                </>
              )}
              {step === 5 && (
                <>
                  <div className="grid gap-5 md:grid-cols-2">
                    {settings.data?.plans.filter(plan => plan.enabled).map(plan => <button type="button" key={plan.id} aria-pressed={data.listing === plan.id} onClick={() => patch("listing", plan.id)} className={`rounded-2xl border p-6 text-left ${data.listing === plan.id ? "border-accent bg-accent/10" : "border-foreground/20"}`}><h3 className="font-editorial text-3xl">{plan.id === 'quarterly' ? 'Quarterly' : 'Annual'}</h3><p className="mt-2 text-muted-foreground">{plan.id === 'quarterly' ? '3 months' : '12 months'}</p><p className="my-5 font-editorial text-4xl">?{plan.price.toLocaleString('en-IN')}</p><p className="text-accent">{data.listing === plan.id ? 'Selected ?' : 'Choose this plan'}</p></button>)}
                  </div>
                  {settings.isLoading && <p>Loading plans?</p>}
                  {settings.isError && <button type="button" onClick={() => settings.refetch()}>Could not load plans. Retry</button>}
                  <Notice>A Quarterly or Annual plan is required. Payment confirmation and activation are arranged separately after submission.</Notice>
                  <section className="rounded-2xl border border-foreground/10 p-5">
                    <h3 className="font-editorial text-2xl">
                      Additional Profile Opportunities
                    </h3>
                    <p className="mt-3 text-sm leading-7 text-muted-foreground">
                      We may also have connected partner platforms that offer
                      additional profile registration opportunities. Eligible
                      members may have the option to receive free registration
                      on selected partner platforms.
                    </p>
                    <p className="mt-3 text-sm leading-7">
                      Participation is completely optional and you can choose
                      whether or not you want to receive information about these
                      opportunities.
                    </p>
                    <label className="mt-4 flex items-start gap-3 text-sm">
                      <input
                        className="mt-1 accent-pink-500"
                        type="checkbox"
                        checked={data.partnerOptIn}
                        onChange={(e) =>
                          patch("partnerOptIn", e.target.checked)
                        }
                      />
                      I am interested in receiving information about additional
                      partner platform opportunities.
                    </label>
                  </section>
                </>
              )}
              {step === 6 && (
                <>
                  <RegistrationSummary data={data} edit={go} />
                  <div className="grid gap-4 rounded-2xl bg-background/60 p-5">
                    {(["accurate", "terms", "adult"] as const).map((key) => (
                      <label
                        key={key}
                        className="flex items-start gap-3 text-sm leading-6"
                      >
                        <input
                          type="checkbox"
                          required
                          checked={data[key]}
                          onChange={(e) => patch(key, e.target.checked)}
                          className="mt-1.5 accent-pink-500"
                        />
                        <span>
                          {key === "accurate" ? (
                            "I confirm that the information provided is accurate."
                          ) : key === "adult" ? (
                            "I confirm that I meet the minimum age requirement for registration (18+)."
                          ) : (
                            <>
                              I agree to the{" "}
                              <a
                                href={settings.data?.termsUrl || "/terms"}
                                target="_blank"
                                rel="noreferrer"
                                className="text-accent underline"
                              >
                                Terms & Conditions
                              </a>{" "}
                              and{" "}
                              <a
                                href={settings.data?.privacyUrl || "/privacy"}
                                target="_blank"
                                rel="noreferrer"
                                className="text-accent underline"
                              >
                                Privacy Policy
                              </a>
                              .
                            </>
                          )}
                        </span>
                      </label>
                    ))}
                  </div>
                </>
              )}
              {Object.values(errors).some(Boolean) && (
                <div
                  role="alert"
                  className="rounded-xl border border-primary/30 bg-primary/5 p-4 text-sm text-primary"
                >
                  {[...new Set(Object.values(errors).filter(Boolean))].map(
                    (error) => (
                      <p key={error}>{error}</p>
                    ),
                  )}
                </div>
              )}
              {register.isError && (
                <p role="alert" className="text-sm text-primary">
                  {errorMessage(register.error)}
                </p>
              )}
            </div>
            {!existing && step > 0 && step < 5 && (
              <div className="mt-6 text-center">
                <button
                  type="button"
                  disabled={uploading || register.isPending}
                  onClick={() => {
                    go(step + 1);
                  }}
                  className="rounded-full px-5 py-3 text-sm text-muted-foreground underline underline-offset-4 hover:text-accent disabled:opacity-50"
                >
                  Skip for now
                </button>
                <p className="mt-1 text-xs text-muted-foreground">
                  You can complete this later from your dashboard.
                </p>
              </div>
            )}
            {!existing && <label className="mt-5 flex gap-3 text-sm"><input type="checkbox" checked={data.terms && data.adult && data.accurate} onChange={e=>setData({...data,terms:e.target.checked,adult:e.target.checked,accurate:e.target.checked})}/>I am 18 or older, my details are accurate, and I agree to the terms and privacy policy.</label>}
            {!existing && errors.confirmations && <p role="alert" className="mt-3 text-primary">{errors.confirmations}</p>}
            <div className="mt-8 flex items-center justify-between gap-3 border-t border-foreground/10 pt-6">
              {step > 0 ? (
                <button
                  type="button"
                  className={secondary}
                  onClick={() => go(step - 1)}
                  disabled={register.isPending}
                >
                  <ArrowLeft size={16} />
                  Back
                </button>
              ) : (
                <span className="text-xs text-muted-foreground">
                  Create your account for review
                </span>
              )}
              <button
                type="submit"
                disabled={uploading || register.isPending}
                className={primary}
              >
                {register.isPending
                  ? "Submitting…"
                  : !existing ? "Register account" : step === 6
                    ? "Submit My Profile"
                    : "Continue"}
                <ArrowRight size={16} />
              </button>
            </div>
          </form>
        </div>
        <p className="mt-6 text-center text-xs text-muted-foreground">
          Your details stay with you as you move between steps. Already
          registered?{" "}
          <Link href="/dashboard" className="text-accent underline">
            Log in
          </Link>
        </p>
      </div>
    </div>
  );
}

export function MemberArea({
  profile = false,
  complete = false,
  interests = false,
  boost = false,
}: {
  profile?: boolean;
  complete?: boolean;
  interests?: boolean;
  boost?: boolean;
}) {
  const query = useGetMyRegistration({
    query: { queryKey: ["/api/registration/me"], retry: false },
  });
  const login = useLoginRegistration();
  const [mobile, setMobile] = useState("");
  const [password, setPassword] = useState("");
  if (query.isLoading)
    return (
      <p className="p-12 text-center" role="status">
        Loading your profile…
      </p>
    );
  if (query.isError || !query.data || !["Approved", "Profile pending", "Profile rejected"].includes(query.data.reviewStatus))
    return (
      <div className="mx-auto max-w-md px-5 py-16">
        <h1 className="font-editorial text-4xl">Welcome back.</h1>
        <p className="my-4 text-sm text-muted-foreground">
          Log in to view your submitted profile and dashboard.
        </p>
        <form
          className="grid gap-5"
          onSubmit={(e) => {
            e.preventDefault();
            login.mutate(
              { data: { mobile, password } },
              {
                onSuccess: () => {
                  setPassword("");
                  query.refetch();
                },
              },
            );
          }}
        >
          <Field label="Mobile number (with country code)">
            <input
              className={inputClass}
              type="tel"
              autoComplete="username"
              placeholder="+91 98765 43210"
              maxLength={30}
              required
              value={mobile}
              onChange={(e) => setMobile(e.target.value)}
            />
          </Field>
          <Field label="Password">
            <input
              className={inputClass}
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </Field>
          {login.isError && (
            <p role="alert" className="text-sm text-primary">
              {errorMessage(login.error)}
            </p>
          )}
          <button className={primary} disabled={login.isPending}>
            Log in
          </button>
          <Link href="/join" className="text-center text-sm text-accent">
            Create a profile
          </Link>
        </form>
      </div>
    );
  if (complete) return <MembershipGate><Registration key={query.data.listing} existing={query.data} /></MembershipGate>;
  if (interests || boost) return <div className="mx-auto max-w-4xl px-5 py-12"><Link href="/dashboard" className="text-accent">? Dashboard</Link>{interests ? <InterestHistory men /> : <BoostPanel />}</div>;
  return (
    <MembershipGate><div className="mx-auto max-w-3xl px-5 py-12">
      <p className="text-xs uppercase tracking-widest text-accent">
        Rent a Man · Private member area
      </p>
      <h1 className="mt-3 font-editorial text-4xl">
        {profile ? "My Profile" : `Welcome, ${query.data.displayName}`}
      </h1>
      <p className="my-5 text-sm text-muted-foreground">
        Status: {query.data.reviewStatus} · Submitted{" "}
        {new Date(query.data.submittedAt).toLocaleDateString()}
      </p>
      <Notice>
        {query.data.isPublished
          ? "Your profile is approved, complete, and visible on the website."
          : "Complete your profile and submit it for admin review. Your card appears publicly only after the completed profile is approved."}
      </Notice>
      {!query.data.isComplete && (
        <section className="mt-5 rounded-2xl border border-primary/30 bg-primary/5 p-5">
          <h2 className="font-editorial text-2xl">
            Finish your profile to get discovered
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Still needed: {query.data.missingSteps?.join(", ")}
          </p>
          <Link href="/complete-profile" className={`${primary} mt-4`}>
            Complete all steps <ArrowRight size={16} />
          </Link>
        </section>
      )}
      {query.data.isPublished && (
        <Link
          href={`/profile/${query.data.publicSlug}`}
          className={`${secondary} mt-5`}
        >
          View public profile
        </Link>
      )}
      <div className="my-6">
        <Link
          className={secondary}
          href={profile ? "/dashboard" : "/my-profile"}
        >
          {profile ? "Go to Dashboard" : "View My Profile"}
        </Link>
      </div>
      {profile ? (
        <RegistrationSummary data={query.data} />
      ) : (
        <div className="grid gap-5 rounded-2xl border border-foreground/10 p-6">
          <h2 className="font-editorial text-2xl">Your registration</h2>
          <Link href="/complete-profile" className={primary}>
            Complete / Edit My Profile <ArrowRight size={16} />
          </Link>
          <p>
            Listing: <span className="capitalize">{query.data.listing}</span> ·
            ₹{query.data.listingPrice.toLocaleString("en-IN")}
          </p>
          <p className="text-sm text-muted-foreground">
            {query.data.listing === "free"
              ? "Choose Quarterly or Annual when updating your profile."
              : "Premium selected. No payment has been collected and premium is not yet activated."}
          </p>
          <p className="text-sm">
            {query.data.photos.length} photos submitted · {query.data.city}
          </p>
        </div>
      )}
      {!profile && <><InterestHistory men /><BoostPanel /><PlanComparison /></>}
    </div></MembershipGate>
  );
}

export function RegistrationAdmin() {
  const queryClient = useQueryClient();
  const [checking, setChecking] = useState(true);
  const [loggingOut, setLoggingOut] = useState(false);
  const [sessionError, setSessionError] = useState("");
  const [tab, setTab] = useState<"registrations" | "settings" | "discovery" | "seo" | "payments">("registrations");
  const login = useLoginRegistrationAdmin();
  const update = useUpdateRegistrationSettings();
  const [password, setPassword] = useState("");
  const [data, setData] = useState<RegistrationSettings>();
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/registration/admin/session", { credentials: "same-origin", signal: controller.signal })
      .then(async (response) => {
        if (response.ok) setData(await response.json());
        else if (response.status !== 401) setSessionError("Unable to check your session. Please try signing in.");
      })
      .catch(() => {
        if (!controller.signal.aborted) setSessionError("Unable to reach the server. Please try again.");
      })
      .finally(() => { if (!controller.signal.aborted) setChecking(false); });
    return () => controller.abort();
  }, []);
  async function logout() {
    setLoggingOut(true);
    setSessionError("");
    try {
      const response = await fetch("/api/registration/admin/logout", { method: "POST", credentials: "same-origin" });
      if (!response.ok) throw new Error("Logout failed");
      await queryClient.cancelQueries({ queryKey: ["admin-boosts"] });
      queryClient.removeQueries({ queryKey: ["admin-boosts"] });
      await queryClient.cancelQueries({ queryKey: ["admin-viewers"] });
      queryClient.removeQueries({ queryKey: ["admin-viewers"] });
      await queryClient.cancelQueries({ queryKey: ["/api/registration/admin/registrations"] });
      queryClient.removeQueries({ queryKey: ["/api/registration/admin/registrations"] });
      setData(undefined);
      setPassword("");
      setTab("registrations");
      login.reset();
      update.reset();
    } catch {
      setSessionError("Could not log out. Please try again.");
    } finally {
      setLoggingOut(false);
    }
  }
  return (
    <div className="mx-auto max-w-5xl px-5 py-14">
      <p className="text-xs uppercase tracking-widest text-accent">
        Rent a Man · Admin
      </p>
      <h1 className="mt-3 font-editorial text-4xl">{data ? "Member Administration" : "Admin Login"}</h1>
      {!data && <p className="mt-3 text-muted-foreground">Sign in with your admin password to manage registrations and plans.</p>}
      {sessionError && <p role="alert" className="mt-4 text-primary">{sessionError}</p>}
      {data && (
        <div className="mt-6 flex flex-wrap gap-3">
          <button
            className={tab === "registrations" ? primary : secondary}
            onClick={() => setTab("registrations")}
          >
            Registrations
          </button>
          <button
            className={tab === "settings" ? primary : secondary}
            onClick={() => setTab("settings")}
          >
            Pricing & Policies
          </button>
          <button className={tab === "discovery" ? primary : secondary} onClick={() => setTab("discovery")}>Search options</button>
          <button className={tab === "seo" ? primary : secondary} onClick={() => setTab("seo")}>SEO & Sitemaps</button>
          <button className={tab === "payments" ? primary : secondary} onClick={() => setTab("payments")}>Payments</button>
          <button type="button" className={`${secondary} sm:ml-auto`} disabled={loggingOut} onClick={logout}>
            {loggingOut ? "Logging out…" : "Log out"}
          </button>
        </div>
      )}
      {checking ? <p role="status" className="mt-8">Checking your session…</p> : !data ? (
        <form
          className="mt-8 grid max-w-md gap-5 rounded-2xl border border-foreground/10 bg-card p-6 sm:p-8"
          onSubmit={(e) => {
            e.preventDefault();
            login.mutate(
              { data: { password } },
              {
                onSuccess: (result) => {
                  setData(result);
                  setPassword("");
                  setSessionError("");
                },
              },
            );
          }}
        >
          <Field label="Admin password">
            <input
              className={inputClass}
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </Field>
          {login.isError && (
            <p role="alert" className="text-primary">
              {errorMessage(login.error)}
            </p>
          )}
          <button className={primary} disabled={login.isPending}>
            {login.isPending ? "Signing in…" : "Sign in"}
          </button>
        </form>
      ) : tab === "payments" ? <><PaymentSettings /><BoostPanel admin /></> : tab === "seo" ? <SeoAdmin /> : tab === "discovery" ? <DiscoveryOptionsAdmin /> : tab === "registrations" ? (
        <><ViewerQueue /><AdminRegistrationQueue /></>
      ) : (
        <form
          className="mt-8 grid gap-6"
          onSubmit={(e) => {
            e.preventDefault();
            update.mutate({ data }, { onSuccess: setData });
          }}
        >
          <Notice>
            Manage Quarterly and Annual membership prices here. Prices are in INR.
          </Notice>
          {data.plans.map((plan, i) => (
            <div
              key={plan.id}
              className="grid grid-cols-[1fr_auto] items-end gap-4"
            >
              <Field
                label={`${plan.id[0].toUpperCase() + plan.id.slice(1)} price (₹)`}
              >
                <input
                  className={inputClass}
                  type="number"
                  min={0}
                  max={1000000}
                  step="0.01"
                  required
                  value={plan.price}
                  onChange={(e) =>
                    setData({
                      ...data,
                      plans: data.plans.map((p, j) =>
                        i === j ? { ...p, price: Number(e.target.value) } : p,
                      ),
                    })
                  }
                />
              </Field>
              <label className="mb-3 flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={plan.enabled}
                  onChange={(e) =>
                    setData({
                      ...data,
                      plans: data.plans.map((p, j) =>
                        i === j ? { ...p, enabled: e.target.checked } : p,
                      ),
                    })
                  }
                />
                Enabled
              </label>
            </div>
          ))}
          <Field label="Terms & Conditions URL">
            <input
              className={inputClass}
              required
              value={data.termsUrl}
              onChange={(e) => setData({ ...data, termsUrl: e.target.value })}
            />
          </Field>
          <Field label="Privacy Policy URL">
            <input
              className={inputClass}
              required
              value={data.privacyUrl}
              onChange={(e) => setData({ ...data, privacyUrl: e.target.value })}
            />
          </Field>
          {update.isError && (
            <p role="alert" className="text-primary">
              {errorMessage(update.error)}
            </p>
          )}
          {update.isSuccess && (
            <p role="status" className="text-accent">
              Settings saved.
            </p>
          )}
          <button className={primary} disabled={update.isPending}>
            {update.isPending ? "Saving…" : "Save Settings"}
          </button>
        </form>
      )}
    </div>
  );
}
function PlanComparison() {
 const settings = useGetRegistrationSettings();
 return <section className="mt-8 rounded-2xl border border-foreground/15 p-6"><h2 className="font-editorial text-3xl">Membership plans</h2><p className="mt-3 text-sm text-muted-foreground">Choose Quarterly or Annual. All profiles require admin approval. Payment confirmation and activation are arranged separately.</p><div className="mt-5 grid gap-4 sm:grid-cols-2">{settings.data?.plans.filter(p => p.enabled).map(p => <div key={p.id} className="rounded-xl border border-accent/30 p-5"><h3>{p.id === 'quarterly' ? 'Quarterly ? 3 months' : 'Annual ? 12 months'}</h3><p className="mt-3 text-2xl text-accent">?{p.price.toLocaleString('en-IN')}</p></div>)}</div></section>;
}

function AdminRegistrationQueue() {
  const query = useListAdminRegistrations({
    query: {
      queryKey: ["/api/registration/admin/registrations"],
      retry: false,
      refetchInterval: 15000,
    },
  });
  const review = useReviewRegistration();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("All");
  const [notice, setNotice] = useState("");
  const records = query.data || [];
  const visible = records.filter(
    (record) =>
      (filter === "All" || record.reviewStatus === filter) &&
      `${record.displayName} ${record.email} ${record.mobile}`
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  const act = (record: RegistrationRecord, action: "approve" | "reject") => {
    setNotice("");
    review.mutate(
      { id: record.id, data: { action } },
      {
        onSuccess: (result) => {
          setNotice(
            action === "reject"
              ? `${result.displayName}: ${result.reviewStatus === "Profile rejected" ? "Profile changes rejected. The member can log in and resubmit." : "Approval denied. Login and public listing are disabled."}`
              : result.notificationStatus === "Sent"
                ? `${result.displayName}: approved. Telegram notification sent to your admin chat.`
                : `${result.displayName}: approved, but Telegram delivery failed. Check the bot settings and use Retry Telegram.`,
          );
          query.refetch();
        },
      },
    );
  };
  return (
    <section className="mt-8">
      <div className="grid gap-3 sm:grid-cols-3">
        {["Pending approval", "Profile pending", "Approved", "Profile rejected", "Rejected"].map((status) => (
          <button
            key={status}
            onClick={() => setFilter(status)}
            className={`rounded-2xl border p-5 text-left ${filter === status ? "border-accent bg-accent/5" : "border-foreground/10 bg-card"}`}
          >
            <p className="text-xs text-muted-foreground">{status}</p>
            <p className="mt-2 font-editorial text-3xl">
              {
                records.filter((record) => record.reviewStatus === status)
                  .length
              }
            </p>
          </button>
        ))}
      </div>
      <div className="my-5 grid gap-3 sm:grid-cols-[1fr_auto_auto]">
        <input
          aria-label="Search registrations"
          className={inputClass}
          placeholder="Search name, email or mobile"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <select
          aria-label="Filter registrations"
          className={inputClass}
          value={filter}
          onChange={(event) => setFilter(event.target.value)}
        >
          {["All", "Pending approval", "Profile pending", "Profile rejected", "Approved", "Rejected"].map((status) => (
            <option key={status}>{status}</option>
          ))}
        </select>
        <button className={secondary} onClick={() => query.refetch()}>
          Refresh
        </button>
      </div>
      <Notice>
        Approve a registration to allow member login. Only approved, fully
        completed profiles are published. Approval notifications go to your
        configured admin Telegram chat.
      </Notice>
      {notice && (
        <p
          role="status"
          className="mt-4 rounded-xl border border-accent/30 p-4 text-sm"
        >
          {notice}
        </p>
      )}
      {review.isError && (
        <p role="alert" className="mt-4 text-primary">
          {errorMessage(review.error)}
        </p>
      )}
      {query.isLoading && (
        <p className="py-8" role="status">
          Loading registrations…
        </p>
      )}
      {query.isError && (
        <p role="alert" className="py-8 text-primary">
          Could not load registrations. Refresh or sign in again if your admin
          session expired.
        </p>
      )}
      {!query.isLoading && !query.isError && !visible.length && (
        <p className="py-10 text-center text-muted-foreground">
          No registrations match this view.
        </p>
      )}
      <div className="mt-5 grid gap-5">
        {visible.map((record) => (
          <article
            key={record.id}
            className="rounded-2xl border border-foreground/10 bg-card p-5 sm:p-6"
          >
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h3 className="font-editorial text-2xl">
                  {record.displayName}
                </h3>
                <p className="mt-2 break-all text-sm text-muted-foreground">
                  {record.email} · {record.mobile}
                </p>
                <p className="mt-2 text-xs text-muted-foreground">
                  Registered {new Date(record.submittedAt).toLocaleString()} ·{" "}
                  <span className="capitalize">{record.listing}</span>
                </p>
              </div>
              <span
                className={`rounded-full px-3 py-1.5 text-xs ${record.reviewStatus === "Approved" ? "bg-accent/10 text-accent" : "bg-primary/10 text-primary"}`}
              >
                {record.reviewStatus}
              </span>
            </div>
            <div className="mt-4 flex flex-wrap gap-3 text-xs">
              <span>
                {record.isPublished ? "Visible on website" : "Not public"}
              </span>
              <span>
                {record.isComplete
                  ? "All profile steps complete"
                  : `Missing: ${record.missingSteps?.join(", ")}`}
              </span>
              <span>Telegram: {record.notificationStatus}</span>
            </div>
            <details className="mt-5">
              <summary className="cursor-pointer text-sm text-accent">
                Review profile details
              </summary>
              <div className="mt-4">
                <RegistrationSummary data={record} />
              </div>
            </details>
            <div className="mt-5 flex flex-wrap gap-3">
              {record.reviewStatus !== "Approved" && (
                <button
                  className={primary}
                  disabled={review.isPending}
                  onClick={() => act(record, "approve")}
                >
                  {record.reviewStatus.startsWith("Profile") ? "Approve completed profile" : "Approve registration"} <Check size={16} />
                </button>
              )}
              {record.reviewStatus !== "Approved" && <button className={secondary} onClick={async e => { const button = e.currentTarget; button.disabled = true; try { const result = await viewerApi(`registration/admin/registrations/${record.id}/notify`, {}); setNotice(result.notificationStatus === 'Sent' ? 'Registration notification sent to Telegram.' : 'Telegram delivery failed. Check bot token and chat ID on Railway.'); await query.refetch(); } catch { setNotice('Could not retry Telegram notification.'); } finally { button.disabled = false; } }}>Retry registration Telegram</button>}
              {record.reviewStatus === "Approved" &&
                record.notificationStatus !== "Sent" && (
                  <button
                    className={secondary}
                    disabled={review.isPending}
                    onClick={() => act(record, "approve")}
                  >
                    Retry Telegram
                  </button>
                )}
              {record.reviewStatus !== "Rejected" && (
                <button
                  className={secondary}
                  disabled={review.isPending}
                  onClick={() => act(record, "reject")}
                >
                  {record.reviewStatus === "Approved"
                    ? "Revoke approval"
                    : "Reject registration"}
                </button>
              )}
              {record.isPublished && (
                <Link
                  className={secondary}
                  href={`/profile/${record.publicSlug}`}
                >
                  View public profile
                </Link>
              )}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

export function RegistrationPolicy({ privacy = false }: { privacy?: boolean }) {
  return (
    <div className="mx-auto max-w-2xl px-5 py-16">
      <p className="text-xs uppercase tracking-widest text-accent">
        Rent a Man · Demo content
      </p>
      <h1 className="mt-4 font-editorial text-4xl">
        {privacy ? "Privacy Policy" : "Terms & Conditions"}
      </h1>
      <p className="mt-6 text-sm leading-7 text-muted-foreground">
        This is a placeholder page for the registration demo. The platform’s
        final {privacy ? "Privacy Policy" : "Terms & Conditions"} have not been
        published yet.
      </p>
      <p className="mt-4 text-sm leading-7 text-muted-foreground">
        Replace this link with your published policy in Registration Settings
        before accepting real registrations.
      </p>
      <Link href="/join" className={`${secondary} mt-8`}>
        Back to registration
      </Link>
    </div>
  );
}
