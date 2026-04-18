import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/options';
import { createAndExecuteMealAnalysisRun } from '@/services/meal-analysis/meal-analysis-service';
import type { MealAnalysisRunResponse } from '@/types/meal-analysis';

type MealAnalysisRouteContext = {
  params: {
    mealId: string;
  };
};

export async function POST(_request: Request, { params }: MealAnalysisRouteContext) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ message: 'Unauthorized.' }, { status: 401 });
  }

  try {
    const result = await createAndExecuteMealAnalysisRun({
      userId: session.user.id,
      mealId: params.mealId,
    });

    const response: MealAnalysisRunResponse = result.ok
      ? {
          ok: true,
          status: 'SUCCEEDED',
          analysisRunId: result.analysisRunId,
          mealId: result.mealId,
          draftResult: result.draftResult,
        }
      : {
          ok: false,
          status: 'FAILED',
          analysisRunId: result.analysisRunId,
          mealId: result.mealId,
          error: result.error,
        };

    return NextResponse.json(response, { status: result.ok ? 200 : 422 });
  } catch {
    return NextResponse.json(
      {
        ok: false,
        status: 'FAILED',
        message: 'The meal analysis run could not be started right now.',
      },
      { status: 500 },
    );
  }
}
