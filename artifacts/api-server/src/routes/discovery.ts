import { discoveryOptions, locationSlug } from "../lib/discovery-options";
import { Router, type IRouter } from "express";
import { sendTelegramInterest } from "../lib/telegram";
import { getRegisteredPublicProfiles, settings } from "./registration";
import { pool } from "@workspace/db";
import { randomUUID } from "node:crypto";
import { requireViewer } from "./viewers";
import {
  GetDiscoverySummaryResponse,
  GetFeaturedProfilesQueryParams,
  GetFeaturedProfilesResponse,
  GetProfileParams,
  GetProfileResponse,
  ListCitiesResponse,
  ListPlansResponse,
  ListProfilesQueryParams,
  ListProfilesResponse,
  SendInterestBody,
  SendInterestResponse,
  SendInterestParams,
  ToggleFavoriteResponse,
  ToggleFavoriteParams,
} from "@workspace/api-zod";

type ProfileRecord = {
  id: number;
  slug: string;
  displayName: string;
  age: number;
  city: string;
  citySlug: string;
  headline: string;
  imageUrl: string;
  interests: string[];
  lookingFor: string[];
  isVerified: boolean;
  isPremium: boolean;
  isFeatured: boolean;
  isOnline: boolean;
  lastActive: string;
  favouriteCount: number;
  bio: string;
  gallery: string[];
  availability: string;
  responseTime: string;
};

const profiles: ProfileRecord[] = [
  {
    id: 1,
    slug: "rahul-coimbatore",
    displayName: "Rahul",
    age: 28,
    city: "Coimbatore",
    citySlug: "coimbatore",
    headline: "Good conversations, great coffee, zero games.",
    imageUrl: "/assets/rahul-profile.jpg",
    interests: ["Fitness", "Dining", "Travel"],
    lookingFor: ["Dating", "Companionship"],
    isVerified: true,
    isPremium: true,
    isFeatured: true,
    isOnline: true,
    lastActive: "Online now",
    favouriteCount: 42,
    bio: "I like mornings that start with a run and evenings that end somewhere with good food. Looking to meet someone kind, curious, and up for making an ordinary day feel like a story.",
    gallery: ["/assets/rahul-profile.jpg"],
    availability: "Available this weekend",
    responseTime: "Usually replies within an hour",
  },
  {
    id: 2,
    slug: "arjun-chennai",
    displayName: "Arjun",
    age: 32,
    city: "Chennai",
    citySlug: "chennai",
    headline: "Always planning the next escape.",
    imageUrl: "/assets/arjun-profile.jpg",
    interests: ["Travel", "Music", "Food"],
    lookingFor: ["Travel Companion", "Long-Term Dating"],
    isVerified: true,
    isPremium: true,
    isFeatured: true,
    isOnline: true,
    lastActive: "Online now",
    favouriteCount: 36,
    bio: "Weekend road trips, discovering small restaurants, and a playlist for every mood. I appreciate an easy laugh and conversations that keep going long after the first drink.",
    gallery: ["/assets/arjun-profile.jpg"],
    availability: "Flexible evenings",
    responseTime: "Usually replies within 2 hours",
  },
  {
    id: 3,
    slug: "vikram-bangalore",
    displayName: "Vikram",
    age: 29,
    city: "Bangalore",
    citySlug: "bangalore",
    headline: "Active lifestyle, quiet confidence.",
    imageUrl: "/assets/vikram-profile.jpg",
    interests: ["Running", "Movies", "Startups"],
    lookingFor: ["Dating", "Social Companion"],
    isVerified: true,
    isPremium: false,
    isFeatured: true,
    isOnline: false,
    lastActive: "Active 18 min ago",
    favouriteCount: 29,
    bio: "Founder by day, amateur film critic by night. I am happiest outdoors, finding a new neighborhood, or having the kind of dinner where we forget to check the time.",
    gallery: ["/assets/vikram-profile.jpg"],
    availability: "Weekday evenings",
    responseTime: "Usually replies within a day",
  },
  {
    id: 4,
    slug: "karan-hyderabad",
    displayName: "Karan",
    age: 31,
    city: "Hyderabad",
    citySlug: "hyderabad",
    headline: "Here for the good energy.",
    imageUrl: "/assets/karan-profile.jpg",
    interests: ["Social Events", "Dining", "Music"],
    lookingFor: ["Events & Parties", "Companionship"],
    isVerified: true,
    isPremium: true,
    isFeatured: true,
    isOnline: true,
    lastActive: "Online now",
    favouriteCount: 24,
    bio: "I know the best places for live music and late-night conversations. Looking for someone who enjoys a little spontaneity and knows how to be present.",
    gallery: ["/assets/karan-profile.jpg"],
    availability: "Available tonight",
    responseTime: "Usually replies within an hour",
  },
  {
    id: 5,
    slug: "aditya-mumbai",
    displayName: "Aditya",
    age: 27,
    city: "Mumbai",
    citySlug: "mumbai",
    headline: "Dinner, events, and a reason to dress up.",
    imageUrl: "/assets/aditya-profile.jpg",
    interests: ["Art", "Dining", "Events"],
    lookingFor: ["Dinner & Social Companion", "Dating"],
    isVerified: true,
    isPremium: false,
    isFeatured: true,
    isOnline: false,
    lastActive: "Active 42 min ago",
    favouriteCount: 19,
    bio: "I work in design and collect favorite places around the city. I am looking for a genuine connection with someone who likes beautiful details and good company.",
    gallery: ["/assets/aditya-profile.jpg"],
    availability: "Friday and Saturday",
    responseTime: "Usually replies within 3 hours",
  },
  {
    id: 6,
    slug: "rohan-pune",
    displayName: "Rohan",
    age: 34,
    city: "Pune",
    citySlug: "pune",
    headline: "Thoughtful, grounded, and always up for a plan.",
    imageUrl: "/assets/rahul-profile.jpg",
    interests: ["Books", "Travel", "Cooking"],
    lookingFor: ["Long-Term Dating", "Weekend Company"],
    isVerified: true,
    isPremium: true,
    isFeatured: false,
    isOnline: true,
    lastActive: "Online now",
    favouriteCount: 17,
    bio: "A calm person with a curious mind. I enjoy cooking for people, exploring new cities, and making time for the people I care about.",
    gallery: ["/assets/rahul-profile.jpg"],
    availability: "Available on weekends",
    responseTime: "Usually replies within 4 hours",
  },
];

async function publicPlans() {
  const config = await settings();
  return [...config.plans.filter(plan => plan.enabled).map(plan => ({
      id: plan.id === "quarterly" ? 2 : 3,
      name: plan.id === "quarterly" ? "Quarterly" : "Annual",
      price: plan.price,
      duration: plan.id === "quarterly" ? "3 months" : "1 year",
      description: "More visibility for your approved profile.",
      features: ["Priority featured placement", "Premium badge", "Profile boost"],
      popular: plan.id === "yearly", cta: plan.id === "quarterly" ? "Choose quarterly" : "Choose annual",
    }))];
}

const toProfile = (profile: ProfileRecord) => ({
  id: profile.id,
  slug: profile.slug,
  displayName: profile.displayName,
  age: profile.age,
  city: profile.city,
  citySlug: profile.citySlug,
  headline: profile.headline,
  imageUrl: profile.imageUrl,
  interests: profile.interests,
  lookingFor: profile.lookingFor,
  isVerified: profile.isVerified,
  isPremium: profile.isPremium,
  isFeatured: profile.isFeatured,
  isOnline: profile.isOnline,
  lastActive: profile.lastActive,
  favouriteCount: profile.favouriteCount,
});

export const allProfiles = async (): Promise<ProfileRecord[]> => [
  ...profiles,
  ...(await getRegisteredPublicProfiles()),
];
const router: IRouter = Router();

router.get("/profiles", async (req, res) => {
  const query = ListProfilesQueryParams.parse(req.query);
  let result = await allProfiles();
  if (query.city)
    result = result.filter(
      (profile) =>
        locationSlug(profile.city) === query.city ||
        profile.city.toLowerCase() === query.city?.toLowerCase(),
    );
  if (query.lookingFor)
    result = result.filter((profile) =>
      profile.lookingFor.some(value => value.toLowerCase() === query.lookingFor!.toLowerCase()),
    );
  if (query.minAge !== undefined)
    result = result.filter((profile) => profile.age >= query.minAge!);
  if (query.maxAge !== undefined)
    result = result.filter((profile) => profile.age <= query.maxAge!);
  if (query.premium) result = result.filter((profile) => profile.isPremium);
  if (query.verified) result = result.filter((profile) => profile.isVerified);
  if (query.active) result = result.filter((profile) => profile.isOnline);
  if (query.sort === "active")
    result.sort((a, b) => Number(b.isOnline) - Number(a.isOnline));
  if (query.sort === "age") result.sort((a, b) => a.age - b.age);
  if (query.sort === "newest") result.sort((a, b) => b.id - a.id);
  if (query.sort === "featured")
    result.sort((a, b) => Number(b.isPremium) - Number(a.isPremium) || Number(b.isFeatured) - Number(a.isFeatured));
  res.json(ListProfilesResponse.parse(result.map(toProfile)));
});

router.get("/profiles/featured", async (req, res) => {
  const query = GetFeaturedProfilesQueryParams.parse(req.query);
  const result = (await allProfiles()).filter(
    (profile) =>
      profile.isFeatured && (!query.city || profile.citySlug === query.city),
  );
  res.json(GetFeaturedProfilesResponse.parse(result.sort((a, b) => Number(b.isPremium) - Number(a.isPremium)).map(toProfile)));
});

router.get("/profiles/:slug", async (req, res) => {
  const { slug } = GetProfileParams.parse(req.params);
  const profile = (await allProfiles()).find((item) => item.slug === slug);
  if (!profile) {
    res.status(404).json({ error: "Profile not found" });
    return;
  }
  res.json(
    GetProfileResponse.parse({
      ...toProfile(profile),
      bio: profile.bio,
      gallery: profile.gallery,
      availability: profile.availability,
      responseTime: profile.responseTime,
    }),
  );
});

router.post("/profiles/:id/interest", requireViewer, async (req, res) => {
  req.body = { ...req.body, contactType: res.locals.viewer.contactType, contact: res.locals.viewer.contact };
  const params = SendInterestParams.safeParse(req.params);
  const body = SendInterestBody.safeParse(req.body ?? {});
  if (!params.success || !body.success) {
    res
      .status(400)
      .json({
        success: false,
        message:
          "Enter a valid contact method and contact details. Notes must be 500 characters or fewer.",
      });
    return;
  }
  const profile = (await allProfiles()).find(
    (item) => item.id === params.data.id,
  );
  if (!profile) {
    res.status(404).json({ success: false, message: "Profile not found." });
    return;
  }
  const { contactType, note } = body.data;
  const contact =
    contactType === "telegram"
      ? body.data.contact.trim().replace(/^@/, "")
      : body.data.contact.trim().replace(/[\s()-]/g, "");
  const valid =
    contactType === "telegram"
      ? /^[a-zA-Z][a-zA-Z0-9_]{4,31}$/.test(contact)
      : /^\+[1-9]\d{7,14}$/.test(contact);
  if (!valid) {
    res
      .status(400)
      .json({
        success: false,
        message:
          "Enter a valid Telegram username or WhatsApp number with country code.",
      });
    return;
  }
  const interestId = randomUUID();
  await pool.query("INSERT INTO member_interests (id, viewer_id, profile_id, profile_slug, profile_name, note) VALUES ($1,$2,$3,$4,$5,$6)", [interestId, res.locals.viewer.id, profile.id, profile.slug, profile.displayName, note?.trim() || ""]);
  try {
    await sendTelegramInterest({
      profileName: profile.displayName,
      profileSlug: profile.slug,
      contactType,
      contact: contactType === "telegram" ? `@${contact}` : contact,
      note: note?.trim(),
    });
    await pool.query("UPDATE member_interests SET delivery = 'Sent' WHERE id = $1", [interestId]);
    res
      .status(201)
      .json(
        SendInterestResponse.parse({
          success: true,
          message: "Your introduction has been sent.",
        }),
      );
  } catch {
    await pool.query("UPDATE member_interests SET delivery = 'Failed' WHERE id = $1", [interestId]);
    res.status(201).json({ success: true, message: "Your interest is saved. Team notification is delayed." });
  }
});

router.post("/profiles/:id/favorite", async (req, res) => {
  const { id } = ToggleFavoriteParams.parse(req.params);
  const profile = (await allProfiles()).find((item) => item.id === id);
  if (!profile) {
    res.status(404).json({ error: "Profile not found" });
    return;
  }
  profile.favouriteCount += 1;
  res.json(
    ToggleFavoriteResponse.parse({
      success: true,
      message: "Profile saved to your favourites.",
      isFavourite: true,
    }),
  );
});

router.get("/cities", async (_req, res) => {
  const configured = await discoveryOptions();
  const profiles = await allProfiles();
  const result = configured.locations.map((name, index) => ({
    id: index + 1, name, slug: locationSlug(name),
    profileCount: profiles.filter(profile => locationSlug(profile.city) === locationSlug(name)).length,
  }));
  res.json(ListCitiesResponse.parse(result));
});

router.get("/plans", async (_req, res) => {
  res.json(ListPlansResponse.parse(await publicPlans()));
});

router.get("/discovery-summary", async (_req, res) => {
  const currentProfiles = await allProfiles();
  res.json(
    GetDiscoverySummaryResponse.parse({
      profileCount: currentProfiles.length,
      cityCount: new Set(currentProfiles.map((profile) => profile.citySlug))
        .size,
      verifiedCount: currentProfiles.filter((profile) => profile.isVerified)
        .length,
      activeNowCount: currentProfiles.filter((profile) => profile.isOnline)
        .length,
    }),
  );
});

export default router;
