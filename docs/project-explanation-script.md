# ReVive Project Video Script — Two Speakers

**Speaker 1:** Hello, and welcome. We’re here to introduce **ReVive**, a platform designed to make household recycling easier to arrange and easier to follow. ReVive connects residents who have recyclable materials with delivery partners who can collect them, recycling centers that process them, and administrators who oversee the service.

**Speaker 2:** The problem we wanted to address is that recycling often depends on people figuring out several disconnected steps themselves: where to take materials, how to arrange transport, and whether the material was actually received. ReVive brings those steps into one workflow. A resident requests a pickup, a delivery partner handles the route, and the recycling center records and verifies what it receives.

**Speaker 1:** The platform has four roles, each with its own views and responsibilities. Residents can schedule and track pickups, find recycling centers, manage their profile, and see their reward points. Delivery partners can review available jobs, accept suitable pickups, update delivery progress, and view their delivery history and earnings. Recycling centers can manage their facility profile, see incoming material, confirm received weights, and verify recycling. Administrators can oversee users, center applications, pickups, and reward settings.

**Speaker 2:** Let’s walk through a pickup. A resident chooses a material category, enters the pickup details, selects a date, and provides a location. They can type an address or select a point on the map. Once there are saved coordinates, ReVive can compare the pickup with eligible recycling centers and show distance information to help the resident choose.

**Speaker 1:** The map uses **Leaflet** with **OpenStreetMap** map tiles. The delivery job view can show three useful route figures: the delivery partner’s base to the pickup, the pickup to the recycling center, and the total route. Distances depend on saved map coordinates. Road routing is shown when available; if routing information is unavailable, the interface may use a straight-line estimate or indicate that the distance cannot be calculated. Address search and address lookup from device location use Mapbox when a local Mapbox API key is configured. A user can still place a map pin manually.

**Speaker 2:** After the resident submits the request, an eligible delivery partner can find it in the jobs view. The partner sees the pickup address, destination center, scheduled date, material and estimated load, plus the route distances available for that job. Before accepting, the partner can consider whether the job fits their registered vehicle capacity. They then accept the pickup and update its progress as the material is collected and delivered.

**Speaker 1:** At the recycling center, staff confirm the material that arrived and enter the actual received weight. That verified weight matters. A request alone does not count as completed recycling: the center’s verification is the step that qualifies the pickup for resident rewards and delivery earnings. The resident can follow the status through the pickup timeline, while the center’s inventory and the delivery partner’s completed history reflect the verified work.

**Speaker 2:** ReVive’s delivery earnings use a transparent calculation: a **₹20 base fee per completed pickup**, **₹5 per recorded kilometre**, and **₹1 per kilogram based on center-verified weight**, plus eligible bonuses. The configured bonus rules cover daily pickup milestones, heavy loads, verified recycling, and reliability. For example, the ten-pickup daily milestone of ₹120 replaces the ₹50 five-pickup milestone; the two milestones do not stack. The application checks vehicle weight limits and is designed to prevent the same bonus from being counted twice.

**Speaker 1:** These figures are calculated earnings in the application, not a cash transfer. A completed and center-verified pickup is required for the payment calculation. This also makes the calculation easier to explain: the distance comes from the route, the weight comes from the center’s verification, and eligible bonuses are applied according to the configured rules.

**Speaker 2:** The frontend is built with **React 19** and **Vite**. **React Router** supports the different role-specific pages, **Tailwind CSS** is used for styling, **Recharts** powers dashboard graphs, and **Lucide** supplies interface icons. The maps use **Leaflet** and **React Leaflet**. The backend is written in **TypeScript** and uses the AWS SDK to work with DynamoDB and Cognito-related services.

**Speaker 1:** The planned AWS architecture is described in an **AWS SAM** template. It defines an API Gateway HTTP API connected to Lambda handlers, a DynamoDB table for application data, and a Cognito user pool for authentication. The template also configures JWT authorization for protected routes, browser CORS settings, and DynamoDB protections such as deletion protection and point-in-time recovery. The Vite frontend can be built as static files for hosting with services such as Amazon S3 and CloudFront.

**Speaker 2:** It’s important to describe the current status accurately: this project has **not** been deployed to AWS, and no staging AWS resources have been created. The local development workflow runs the API on the developer’s computer and uses **DynamoDB Local** for supported backend data. That lets us develop and demonstrate the pickup-to-verification flow without creating cloud resources. Some demo or unsupported screens can still use browser local storage, which is why the interface may show a demo-mode notice. In those cases, the data is simulated in that browser rather than saved through the backend.

**Speaker 1:** Building ReVive has helped us learn how to design around multiple roles while keeping one shared workflow consistent. We’ve worked through connecting a frontend to API routes, modeling pickup status changes, saving data locally, and making rewards depend on verified activity. The map work also showed us why addresses alone are not enough for reliable distance calculations: the system needs usable coordinates.

**Speaker 2:** We’ve also learned to distinguish a local prototype from a production service. Before launch, the AWS environment, authentication configuration, deployment, and full production checks still need to be completed. Being clear about that status is part of building a system people can trust.

**Speaker 1:** In our demonstration, we’ll begin as a resident by creating a pickup and comparing the recommended centers and route distances. Then we’ll switch to the delivery partner view, accept the job, and show how the pickup moves through the delivery steps.

**Speaker 2:** Next, we’ll switch to the recycling center, enter the received weight, and verify the recycling. Finally, we’ll return to the resident’s rewards and the delivery partner’s earnings history to show how that verification updates both sides of the workflow.

**Speaker 1:** ReVive is our effort to make recycling collection more convenient and accountable by connecting the resident, the delivery partner, and the recycling center in one traceable process.

**Speaker 2:** Thank you for watching our presentation of ReVive.
