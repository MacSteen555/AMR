import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { captureRouteError } from "@/lib/sentry";

export async function GET(
    req: NextRequest,
    { params }: { params: { competitorId: string } }
) {
    try {
        const supabase = createSupabaseServiceRoleClient();

        // 1. Fetch top 10 recent reviews
        const { data: recentReviews, error: recentError } = await supabase
            .schema('app')
            .from('competitor_reviews')
            .select('*')
            .eq('competitor_id', params.competitorId)
            .order('review_date', { ascending: false, nullsFirst: false })
            .limit(10);

        if (recentError) {
            console.error('Error fetching recent reviews:', recentError);
            return NextResponse.json({ error: "Failed to fetch recent reviews" }, { status: 500 });
        }

        // 2. Fetch all reviews with a date to calculate historical stats
        const { data: allReviews, error: allReviewsError } = await supabase
            .schema('app')
            .from('competitor_reviews')
            .select('rating, review_date, details')
            .eq('competitor_id', params.competitorId)
            .not('review_date', 'is', null)
            .order('review_date', { ascending: true });

        if (allReviewsError) {
            console.error('Error fetching all reviews:', allReviewsError);
            return NextResponse.json({ error: "Failed to fetch stats" }, { status: 500 });
        }

        // Group by month (YYYY-MM)
        const monthlyStats: Record<string, { totalRating: number; count: number }> = {};

        allReviews.forEach((review: any) => {
            const dateObj = new Date(review.review_date);
            // Format YYYY-MM
            const monthKey = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}`;

            if (!monthlyStats[monthKey]) {
                monthlyStats[monthKey] = { totalRating: 0, count: 0 };
            }
            monthlyStats[monthKey].totalRating += review.rating;
            monthlyStats[monthKey].count += 1;
        });

        // 3. Calculate category breakdown from the `details` jsonb column
        const categoryAggregates: Record<string, { total: number; count: number }> = {};
        allReviews.forEach((review: any) => {
            if (review.details && typeof review.details === 'object') {
                for (const [key, val] of Object.entries(review.details)) {
                    if (typeof val === 'number') {
                        // Standardize keys (e.g., 'food', 'service', 'atmosphere')
                        const cat = key.charAt(0).toUpperCase() + key.slice(1);
                        if (!categoryAggregates[cat]) {
                            categoryAggregates[cat] = { total: 0, count: 0 };
                        }
                        categoryAggregates[cat].total += val;
                        categoryAggregates[cat].count += 1;
                    }
                }
            }
        });

        const categoryStats = Object.keys(categoryAggregates).map(cat => ({
            subject: cat,
            A: Number((categoryAggregates[cat].total / categoryAggregates[cat].count).toFixed(1)),
            fullMark: 5
        }));

        // Convert to array and format for charts
        const historicalStats = Object.keys(monthlyStats).sort().map(month => {
            const stat = monthlyStats[month];

            // Format to readable month, e.g., "Jan 24"
            const [year, m] = month.split('-');
            const date = new Date(parseInt(year), parseInt(m) - 1);
            const shortMonth = date.toLocaleString('default', { month: 'short' });
            const shortYear = year.slice(-2);

            return {
                rawMonth: month,
                month: `${shortMonth} '${shortYear}`,
                avgRating: Number((stat.totalRating / stat.count).toFixed(1)),
                reviewCount: stat.count
            };
        });

        return NextResponse.json({
            recent_reviews: recentReviews,
            historical_stats: historicalStats,
            category_stats: categoryStats
        });

    } catch (error: any) {
        console.error('Error in competitor stats route:', error);
        captureRouteError(error, { route: '/api/competitors/[competitorId]/stats' })
        return NextResponse.json(
            { error: error.message || "Internal server error" },
            { status: 500 }
        );
    }
}
