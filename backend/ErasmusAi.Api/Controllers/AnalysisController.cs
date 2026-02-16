using ErasmusAi.Api.Models.AI;
using ErasmusAi.Api.Services.AI;
using Microsoft.AspNetCore.Mvc;

namespace ErasmusAi.Api.Controllers
{
    [Route("api/ai")]
    [ApiController]
    public class AnalysisController : ControllerBase
    {
        private readonly FormAnalysisService _formAnalysisService;

        public AnalysisController(FormAnalysisService formAnalysisService)
        {
            _formAnalysisService = formAnalysisService;
        }

        [HttpPost("analyze-form")]
        public async Task<IActionResult> AnalyzeForm([FromBody] FormAnalysisRequest request)
        {
            if (request == null || string.IsNullOrWhiteSpace(request.FormText))
                return BadRequest("Form text is required.");

            try
            {
                var result = await _formAnalysisService.AnalyzeFormAsync(request.FormText);
                return Ok(result);
            }
            catch (Exception ex)
            {
                return StatusCode(500, $"Internal server error: {ex.Message}");
            }
        }

        [HttpPost("analyze-project")]
        public async Task<IActionResult> AnalyzeProject([FromBody] ProjectAnalysisRequest request)
        {
            if (request == null || string.IsNullOrWhiteSpace(request.ProjectText))
                return BadRequest("Project text is required.");

            try
            {
                var result = await _formAnalysisService.AnalyzeProjectAsync(request.ProjectText);
                return Ok(result);
            }
            catch (Exception ex)
            {
                return StatusCode(500, $"Internal server error: {ex.Message}");
            }
        }
    }
}
