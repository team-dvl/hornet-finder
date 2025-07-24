#!/bin/bash
# Script pour redémarrer nginx avec la nouvelle configuration

echo "🔧 Redémarrage de nginx avec la nouvelle configuration..."

# Vérifier la configuration nginx
echo "📋 Vérification de la configuration nginx..."
docker-compose exec nginx nginx -t

if [ $? -eq 0 ]; then
    echo "✅ Configuration nginx valide"
    
    # Redémarrer nginx
    echo "🔄 Redémarrage de nginx..."
    docker-compose restart nginx
    
    if [ $? -eq 0 ]; then
        echo "✅ Nginx redémarré avec succès"
        echo ""
        echo "🎯 Les nouvelles headers de sécurité permettent maintenant :"
        echo "   - frame-src https://auth.velutina.ovh (pour les iframes OIDC)"
        echo "   - child-src https://auth.velutina.ovh (pour les fenêtres popup)"
        echo "   - X-Frame-Options SAMEORIGIN (au lieu de DENY)"
        echo "   - frame-ancestors 'self' https://auth.velutina.ovh"
        echo ""
        echo "🧪 Pour tester :"
        echo "   1. Rechargez l'application"
        echo "   2. Tapez authTester.test() dans la console"
        echo "   3. Vérifiez qu'il n'y a plus d'erreurs CSP"
    else
        echo "❌ Erreur lors du redémarrage de nginx"
        exit 1
    fi
else
    echo "❌ Configuration nginx invalide"
    exit 1
fi
