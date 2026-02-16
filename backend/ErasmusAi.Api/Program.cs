using ErasmusAi.Api.Data;
using ErasmusAi.Api.Services.AI;
using ErasmusAi.Api.Services.AI.Interfaces;
using ErasmusAi.Api.Services.AI.Internal;
using ErasmusAi.Api.Services.AI.Providers;
using ErasmusAi.Api.Services.Security;
using Microsoft.AspNetCore.Diagnostics;
using Microsoft.EntityFrameworkCore;

var builder = WebApplication.CreateBuilder(args);

// Add services to the container.
builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

// Enable CORS
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowViteApp",
        policy =>
        {
            policy.WithOrigins("http://localhost:5173", "http://localhost:5174")
                  .AllowAnyHeader()
                  .AllowAnyMethod();
        });
});

// Configure SQLite
builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseSqlite(builder.Configuration.GetConnectionString("DefaultConnection")));

// Configure AI Provider
builder.Services.AddHttpClient(); // Registers IHttpClientFactory
builder.Services.AddScoped<AIService>();
builder.Services.AddScoped<PromptBuilderService>();
builder.Services.AddScoped<ResponseFormatterService>();
builder.Services.AddScoped<FormAnalysisService>();
builder.Services.AddScoped<ContextReducer>();
builder.Services.AddScoped<SmartContextReducerService>();

// Security & Config Services (Singleton for runtime config)
builder.Services.AddSingleton<EncryptedKeyStore>();
builder.Services.AddSingleton<ProviderConfigService>();

// Register Concrete Providers using AddHttpClient to inject HttpClient automatically
builder.Services.AddScoped<MockProvider>();
builder.Services.AddHttpClient<OllamaProvider>();
builder.Services.AddHttpClient<GeminiProvider>();
builder.Services.AddHttpClient<GroqProvider>();
builder.Services.AddHttpClient<HuggingFaceProvider>();
builder.Services.AddHttpClient<OpenAIProvider>();

// Register Dynamic Provider as the main IAIProvider
builder.Services.AddScoped<IAIProvider, DynamicAIProvider>();

var app = builder.Build();

// Configure the HTTP request pipeline.
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseExceptionHandler(errorApp =>
{
    errorApp.Run(async context =>
    {
        var exception = context.Features.Get<IExceptionHandlerPathFeature>()?.Error;
        context.Response.StatusCode = StatusCodes.Status500InternalServerError;
        context.Response.ContentType = "application/json";

        await context.Response.WriteAsJsonAsync(new
        {
            success = false,
            error = exception?.Message ?? "An unhandled error occurred"
        });
    });
});

if (!app.Environment.IsDevelopment())
{
    app.UseHttpsRedirection();
}
app.UseAuthorization();

app.UseCors("AllowViteApp");

app.MapControllers();

app.Run();
