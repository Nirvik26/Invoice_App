from django.urls import path
from billing import views

urlpatterns = [
    path('api/workspace/', views.workspace),
    path('api/command/', views.command),
    path('api/guest/<uuid:token>/', views.guest),
    path('api/qr/<uuid:token>/', views.qr),
]
