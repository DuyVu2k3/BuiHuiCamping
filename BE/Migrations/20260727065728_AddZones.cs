using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace BuiHuiCamping.API.Migrations
{
    /// <inheritdoc />
    public partial class AddZones : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "ZoneId",
                table: "Tents",
                type: "int",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "Zones",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    Name = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    Description = table.Column<string>(type: "nvarchar(max)", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Zones", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_Tents_ZoneId",
                table: "Tents",
                column: "ZoneId");

            migrationBuilder.AddForeignKey(
                name: "FK_Tents_Zones_ZoneId",
                table: "Tents",
                column: "ZoneId",
                principalTable: "Zones",
                principalColumn: "Id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Tents_Zones_ZoneId",
                table: "Tents");

            migrationBuilder.DropTable(
                name: "Zones");

            migrationBuilder.DropIndex(
                name: "IX_Tents_ZoneId",
                table: "Tents");

            migrationBuilder.DropColumn(
                name: "ZoneId",
                table: "Tents");
        }
    }
}
