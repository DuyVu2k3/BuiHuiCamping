using Microsoft.AspNetCore.SignalR;

namespace BuiHuiCamping.API.Hubs
{
    public class OrderHub : Hub
    {
        // Clients can connect to this hub to receive real-time notifications
        public override async Task OnConnectedAsync()
        {
            await base.OnConnectedAsync();
            // We can add logic to join groups (e.g., Staff vs Kitchen) if needed later
        }

        // Called by Customer when clicking Checkout
        public async Task RequestCheckout(string tentName)
        {
            await Clients.All.SendAsync("CheckoutRequested", tentName);
        }
    }
}
