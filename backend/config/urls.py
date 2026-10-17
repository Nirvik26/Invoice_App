from django.urls import path
from billing import views
from billing.preferences import preferences, widget_image
from .health import live, ready

handler500 = 'config.middleware.server_error'

urlpatterns = [
    path('api/widget-image/<uuid:identifier>/', widget_image),
    path('api/auth-limit/', views.auth_limit, name='auth-limit'),
    path('health/live/', live),
    path('health/ready/', ready),
    path('api/settings/', preferences),
    path('api/workspace/', views.workspace),
    path('api/command/', views.command, name='command'),
    path('api/guest/<uuid:token>/', views.guest),
    path('api/qr/<uuid:token>/', views.qr),
]
