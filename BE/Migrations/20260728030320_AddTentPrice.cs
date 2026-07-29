using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace BuiHuiCamping.API.Migrations
{
    /// <inheritdoc />
    public partial class AddTentPrice : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<decimal>(
                name: "Price",
                table: "Tents",
                type: "decimal(18,2)",
                nullable: false,
                defaultValue: 0m);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "Price",
                table: "Tents");
        }
    }
}
