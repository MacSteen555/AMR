import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/session";
import { captureRouteError } from "@/lib/sentry";

export async function POST(req: NextRequest) {
    try {
        // Check authentication
        await requireUser();

        const { query } = await req.json();

        if (!query) {
            return NextResponse.json({ error: "Query is required" }, { status: 400 });
        }

        // Check if Google Maps API key is configured
        if (!process.env.GOOGLE_MAPS_API_KEY) {
            console.error("Google Maps API key not configured");
            return NextResponse.json(
                { error: "Places search not configured" },
                { status: 503 }
            );
        }

        const response = await fetch(
            "https://places.googleapis.com/v1/places:searchText",
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "X-Goog-Api-Key": process.env.GOOGLE_MAPS_API_KEY || "",
                    "X-Goog-FieldMask": "places.id,places.displayName,places.formattedAddress,places.location,places.types,places.rating,places.userRatingCount,places.websiteUri,places.internationalPhoneNumber,places.regularOpeningHours",
                },
                body: JSON.stringify({
                    textQuery: query,
                    pageSize: 10,
                    rankPreference: "RELEVANCE",
                }),
            }
        );

        if (!response.ok) {
            const errorText = await response.text();
            console.error("Places API Error:", response.status, errorText);

            if (response.status === 403) {
                // Check if it's a billing issue
                if (errorText.includes("billing") && errorText.includes("BILLING_DISABLED")) {
                    return NextResponse.json(
                        {
                            error: "Google Places API requires billing to be enabled",
                            details: "Please enable billing on your Google Cloud project to use places search. Visit the Google Cloud Console to set up billing.",
                            billingRequired: true
                        },
                        { status: 403 }
                    );
                }

                return NextResponse.json(
                    { error: "Google Places API access denied. Please check API key permissions." },
                    { status: 403 }
                );
            }

            if (response.status === 400) {
                return NextResponse.json(
                    { error: "Invalid search query" },
                    { status: 400 }
                );
            }

            return NextResponse.json(
                { error: "Failed to search places", details: errorText },
                { status: response.status }
            );
        }

        const data = await response.json();

        // Process the places data to extract the correct format
        const places = data.places?.map((place: any) => ({
            id: place.id,
            displayName: place.displayName?.text || place.displayName || "Unknown",
            formattedAddress: place.formattedAddress || "Unknown Address",
            location: {
                latitude: place.location?.latitude || null,
                longitude: place.location?.longitude || null,
            },
            types: place.types || [],
            rating: place.rating || null,
            userRatingCount: place.userRatingCount || null,
            websiteUri: place.websiteUri || null,
            phoneNumber: place.internationalPhoneNumber || null,
            openingHours: place.regularOpeningHours || null,
        })) || [];

        return NextResponse.json({ places });
    } catch (error) {
        console.error("Error searching places:", error);
        captureRouteError(error, { route: '/api/google/places/search' })
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        );
    }
}
