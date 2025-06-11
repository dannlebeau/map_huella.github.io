// Inicializar mapa en Nacimiento
const map = L.map('map').setView([-37.5026, -72.6786], 13);

// Capa base OSM
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '&copy; OpenStreetMap contributors'
}).addTo(map);

let poligonoNacimiento = null;

// Cargar y filtrar área de relacionamiento: NACIMIENTO
fetch('data/areas_relacionamiento.geojson')
  .then(res => res.json())
  .then(data => {
    const nacFeatures = data.features.filter(
      f => f.properties.c_dsc_z_adm_pat === "NACIMIENTO"
    );

    if (nacFeatures.length > 0) {
      poligonoNacimiento = nacFeatures[0];

      const layer = L.geoJSON(poligonoNacimiento, {
        style: {
          color: "#3388ff",
          weight: 2,
          fillOpacity: 0.1
        }
      }).addTo(map);

      map.fitBounds(layer.getBounds());

      // Ahora que ya tenemos el polígono, cargamos viviendas
      cargarViviendas();
    }
  });

function cargarViviendas() {
  fetch('data/viviendas_rurales_influencia_buffer.geojson')
    .then(res => res.json())
    .then(data => {
      // Crear un featureCollection vacío para almacenar los puntos dentro
      const viviendasFiltradas = {
        type: "FeatureCollection",
        features: data.features.filter(punto => {
          return turf.booleanPointInPolygon(punto, poligonoNacimiento);
        })
      };

      // Mostrar las viviendas filtradas
      L.geoJSON(viviendasFiltradas, {
        pointToLayer: (feature, latlng) => {
          return L.circleMarker(latlng, {
            radius: 6,
            color: "red",
            fillColor: "red",
            fillOpacity: 1
          });
        },
        onEachFeature: (feature, layer) => {
          layer.on('click', () => {
            const container = document.createElement("div");

            container.innerHTML = `
              <strong>¿Tiene agua?</strong><br/>
              <input type="radio" name="agua" value="sí"> Sí<br/>
              <input type="radio" name="agua" value="no"> No<br/>
              <strong>Tipo de conexión:</strong><br/>
              <select id="conexion">
                <option value="Red pública">Red pública</option>
                <option value="Pozo/Noria">Pozo/Noria</option>
                <option value="Aljibe">Aljibe</option>
                <option value="Río/Vertiente/Lago">Río/Vertiente/Lago</option>
              </select><br/><br/>
              <button id="enviar">Enviar</button>
            `;

            layer.bindPopup(container).openPopup();

            container.querySelector("#enviar").addEventListener("click", () => {
              const tieneAgua = container.querySelector('input[name="agua"]:checked')?.value;
              const tipoConexion = container.querySelector("#conexion").value;

              if (!tieneAgua) {
                alert("Debe seleccionar si tiene agua.");
                return;
              }

              // Guardar datos en la propiedad
              feature.properties.tiene_agua = tieneAgua;
              feature.properties.tipo_conexion = tipoConexion;

              // Cambiar color del punto
              layer.setStyle({
                color: "green",
                fillColor: "green"
              });

              layer.closePopup();

              console.log("Datos guardados en feature:", feature.properties);
            });
          });
        }
      }).addTo(map);
    });
}
