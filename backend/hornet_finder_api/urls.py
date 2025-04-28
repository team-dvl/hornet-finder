"""
URL configuration for hornet_finder_api project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/5.2/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""
# from django.contrib import admin
from django.http import HttpResponse, HttpRequest
from django.urls import path, include
from django.conf import settings
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView


def robots_txt(request: HttpRequest) -> HttpResponse:
    lines = [
        "User-agent: *",
        "Disallow: /"
    ]
    return HttpResponse("\n".join(lines), content_type="text/plain")

urlpatterns = [
    # path('admin/', admin.site.urls),
    path('robots.txt', robots_txt),
    path('api/', include('hornet.urls')),
]

if settings.DEBUG:
    urlpatterns.append(path('api/schema/', SpectacularAPIView.as_view(), name='schema'))
    urlpatterns.append(path('api/docs/', SpectacularSwaggerView.as_view(url_name='schema'), name='swagger-ui'))
