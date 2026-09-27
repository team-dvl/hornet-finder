"""API of the statistics: the catalogue and one statistic's table."""

from drf_spectacular.utils import OpenApiResponse, extend_schema
from rest_framework.response import Response
from rest_framework.views import APIView

from hornet_finder_api.authentication import HasAnyRole, JWTBearerAuthentication

from .base import REGISTRY, ROLES, Scope, StatError, catalogue


def error_response(exc: StatError) -> Response:
    return Response({'error': str(exc)}, status=exc.status)


class StatsView(APIView):
    """Reserved to signed-in users (any role)."""

    def get_authenticators(self):
        return [JWTBearerAuthentication()]

    def get_permissions(self):
        return [HasAnyRole(list(ROLES))]

    @staticmethod
    def statistic_for(stat_id: str, scope: Scope):
        statistic = REGISTRY.get(stat_id)
        if statistic is None:
            raise StatError("Statistique inconnue.", status=404)
        if not statistic.visible_to(scope):
            raise StatError("Cette statistique ne vous est pas ouverte.", status=403)
        return statistic


class StatsCatalogueView(StatsView):
    @extend_schema(responses={200: OpenApiResponse(description='Statistics the caller may open')})
    def get(self, request):
        return Response(catalogue(Scope.from_request(request)))


class StatDetailView(StatsView):
    @extend_schema(responses={200: OpenApiResponse(description='Table of the statistic'),
                              400: OpenApiResponse(description='Invalid parameter')})
    def get(self, request, stat_id):
        scope = Scope.from_request(request)
        try:
            statistic = self.statistic_for(stat_id, scope)
            return Response(statistic.compute(request.query_params, scope))
        except StatError as exc:
            return error_response(exc)
